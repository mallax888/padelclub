// Server side of "fill my empty courts" (see supabase/migrations/029_court_offers.sql
// and lib/offer-rules.ts): previewing an offer for the owner, creating it and telling
// the players, ending it early, and the results afterwards. The price itself is
// checked in lib/booking-price.ts.
import type { SupabaseClient } from '@supabase/supabase-js'
import { VENUES, getVenue } from '@/lib/venues'
import { timezoneForVenueSlug } from '@/lib/timezone'
import { dayHours } from '@/lib/venue-hours'
import { isOpenForBooking, loadVenueSettings, weekFor } from '@/lib/venue-settings'
import { computeCourtPrice } from '@/lib/pricing'
import { formatDate } from '@/lib/utils'
import { sendPushToUser } from '@/lib/push'
import { overlaps, toMin, hhmm } from '@/lib/waitlist-rules'
import {
  estimateOffer, MAX_ACTIVE_PER_CLUB, MAX_RECIPIENTS, offerClosesAt, offersOverlap, PAST_PLAYER_DAYS, summariseOffer, validateOfferInput,
  type OfferLite, type OfferResults,
} from '@/lib/offer-rules'

type Admin = SupabaseClient<any>

const tableMissing = (error: any): boolean =>
  !!error && (error.code === '42P01' || error.code === 'PGRST205' || error.code === '42703' || /(does not exist|schema cache)/i.test(String(error.message ?? '')))

export async function offersReady(db: any): Promise<boolean> {
  const { error } = await db.from('court_offers').select('id').limit(1)
  return !error
}

// Offers still open now (RLS already hides closed ones from players).
export async function loadOpenOffers(db: any, nowMs: number = Date.now()): Promise<OfferLite[]> {
  const { data, error } = await db.from('court_offers').select('*').eq('status', 'active')
  if (error || !data) return []
  return (data as OfferLite[]).filter(o => Date.parse(o.closes_at) > nowMs)
}

export type OfferWindow = { venueSlug: string; date: string; startTime: string; endTime: string; percent: number }
export type OfferPreview = { courtsFree: number; listTotal: number; offerTotal: number; recipients: { past_players: number; home_club: number } }

const isoDaysAgo = (nowMs: number, days: number) => new Date(nowMs - days * 86400000).toISOString().slice(0, 10)

async function venueCourts(db: any, slug: string) {
  const { data } = await db.from('courts').select('id, name, price_per_hour, price_per_hour_peak, is_active').eq('venue_slug', slug).eq('is_active', true)
  return ((data ?? []) as any[])
}

// Players who booked at this club recently (not blocks), who haven't a booking in the window.
async function pastPlayerIds(db: any, courtIds: string[], nowMs: number): Promise<string[]> {
  if (courtIds.length === 0) return []
  const { data } = await db.from('bookings').select('user_id, date, status').in('court_id', courtIds).in('status', ['confirmed', 'completed'])
  const since = isoDaysAgo(nowMs, PAST_PLAYER_DAYS)
  return Array.from(new Set(((data ?? []) as any[]).filter(b => b.user_id && b.date >= since).map(b => b.user_id as string)))
}

async function homeClubIds(db: any, slug: string): Promise<string[]> {
  const { data } = await db.from('profiles').select('id').eq('home_venue_slug', slug)
  return ((data ?? []) as any[]).map(p => p.id as string)
}

// What the owner sees before sending: the courts that are really free in the window,
// what they'd earn at list price and with the discount, and who would be told.
export async function previewOffer(admin: Admin, w: OfferWindow, nowMs: number = Date.now()): Promise<OfferPreview> {
  const db: any = admin
  const courts = await venueCourts(db, w.venueSlug)
  const { data: busy } = await db.from('bookings').select('court_id, start_time, duration_minutes, status').in('court_id', courts.map(c => c.id)).eq('date', w.date).in('status', ['confirmed', 'blocked'])
  const s = toMin(w.startTime), dur = toMin(w.endTime) - toMin(w.startTime)
  const free = courts.filter(c => !((busy ?? []) as any[]).some(b => b.court_id === c.id && overlaps(toMin(b.start_time), b.duration_minutes ?? 60, s, dur)))
  const { listTotal, offerTotal } = estimateOffer(free.map(c => computeCourtPrice(c, w.date, hhmm(w.startTime), dur / 60, 0)), w.percent)
  const [past, home] = await Promise.all([pastPlayerIds(db, courts.map(c => c.id), nowMs), homeClubIds(db, w.venueSlug)])
  return { courtsFree: free.length, listTotal, offerTotal, recipients: { past_players: past.length, home_club: home.length } }
}

export type CreateOfferResult = { ok: true; offer: OfferLite; told: number } | { ok: false; status: number; error: string }
const fail = (status: number, error: string): CreateOfferResult => ({ ok: false, status, error })

export async function createOffer(admin: Admin, input: OfferWindow & { audience: string; createdBy: string }, nowMs: number = Date.now()): Promise<CreateOfferResult> {
  const db: any = admin
  if (!VENUES.some(v => v.slug === input.venueSlug)) return fail(400, 'Unknown club.')
  if (input.audience !== 'past_players' && input.audience !== 'home_club') return fail(400, 'Invalid request.')
  const tz = timezoneForVenueSlug(input.venueSlug)
  const settings = await loadVenueSettings(db)
  if (!isOpenForBooking(settings, input.venueSlug)) return fail(400, "This club isn't open for booking yet.")
  const hours = dayHours(weekFor(settings, input.venueSlug), input.date)
  const problem = validateOfferInput(
    { date: input.date, startTime: input.startTime, endTime: input.endTime, percent: input.percent },
    hours ? { nowMs, tz, open: hours.open, close: hours.close } : null,
  )
  if (problem) return fail(400, problem)
  const courts = await venueCourts(db, input.venueSlug)
  if (courts.length === 0) return fail(400, 'That club has no courts yet.')

  const { data: existing, error: readError } = await db.from('court_offers').select('*').eq('venue_slug', input.venueSlug).eq('status', 'active')
  if (tableMissing(readError)) return fail(503, "Offers aren't switched on yet. Run the 029 database change first.")
  if (readError) return fail(500, 'Could not save the offer. Please try again.')
  const open = ((existing ?? []) as OfferLite[]).filter(o => Date.parse(o.closes_at) > nowMs)
  const candidate = { date: input.date, start_time: `${input.startTime}:00`, end_time: `${input.endTime}:00` }
  if (open.some(o => offersOverlap(o, candidate))) return fail(409, 'There is already an offer running for part of those hours.')
  if (open.length >= MAX_ACTIVE_PER_CLUB) return fail(400, `A club can have up to ${MAX_ACTIVE_PER_CLUB} offers open at once.`)

  const preview = await previewOffer(admin, input, nowMs)
  const { data: offer, error } = await db.from('court_offers').insert({
    venue_slug: input.venueSlug, date: input.date, start_time: `${input.startTime}:00`, end_time: `${input.endTime}:00`,
    discount_percent: input.percent, audience: input.audience, courts_free: preview.courtsFree, status: 'active', told_count: 0,
    closes_at: offerClosesAt(input.date, input.startTime, tz).toISOString(), created_by: input.createdBy,
  }).select('*').single()
  if (tableMissing(error)) return fail(503, "Offers aren't switched on yet. Run the 029 database change first.")
  if (error || !offer) return fail(500, 'Could not save the offer. Please try again.')

  // Who hears about it: not anyone who already has a booking in those hours.
  const ids = input.audience === 'home_club' ? await homeClubIds(db, input.venueSlug) : await pastPlayerIds(db, courts.map(c => c.id), nowMs)
  const { data: taken } = await db.from('bookings').select('user_id, start_time, duration_minutes').in('court_id', courts.map(c => c.id)).eq('date', input.date).in('status', ['confirmed', 'blocked'])
  const s = toMin(input.startTime), dur = toMin(input.endTime) - s
  const busyUsers = new Set(((taken ?? []) as any[]).filter(b => b.user_id && overlaps(toMin(b.start_time), b.duration_minutes ?? 60, s, dur)).map(b => b.user_id as string))
  const audience = ids.filter(id => !busyUsers.has(id)).slice(0, MAX_RECIPIENTS)

  const closes = new Intl.DateTimeFormat('en-NZ', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(offer.closes_at))
  const message = `${input.percent}% off ${formatDate(input.date)}, ${input.startTime}–${input.endTime} at ${getVenue(input.venueSlug).name}. Book before ${closes}.`
  for (let i = 0; i < audience.length; i += 100) {
    await db.from('notifications').insert(audience.slice(i, i + 100).map(user_id => ({ user_id, type: 'court_offer', message })))
  }
  for (let i = 0; i < audience.length; i += 20) {
    await Promise.all(audience.slice(i, i + 20).map(id => sendPushToUser(admin as any, id, { title: `${input.percent}% off courts`, body: message, url: '/book?offer=1' }).catch(() => null)))
  }
  await db.from('court_offers').update({ told_count: audience.length }).eq('id', offer.id)
  return { ok: true, offer: { ...offer, told_count: audience.length }, told: audience.length }
}

// End an offer early. Bookings already made under it keep their price (see offerValidForBooking).
export async function endOffer(admin: Admin, id: string, nowMs: number = Date.now()): Promise<{ ok: true; venueSlug: string } | { ok: false; status: number; error: string }> {
  const db: any = admin
  const { data: offer } = await db.from('court_offers').select('id, venue_slug, status').eq('id', id).maybeSingle()
  if (!offer) return { ok: false, status: 404, error: 'We could not find that offer.' }
  if (offer.status === 'active') await db.from('court_offers').update({ status: 'cancelled', cancelled_at: new Date(nowMs).toISOString() }).eq('id', id).eq('status', 'active')
  return { ok: true, venueSlug: offer.venue_slug }
}

export type OfferRow = OfferLite & { audience: string; told_count: number; courts_free: number | null; results: OfferResults; ended: boolean }

// The owner's list: recent offers with what they achieved.
export async function loadOfferRows(admin: Admin, venueSlugs: string[] | null, nowMs: number = Date.now()): Promise<OfferRow[] | null> {
  const db: any = admin
  let q = db.from('court_offers').select('*').order('created_at', { ascending: false }).limit(30)
  if (venueSlugs) q = q.in('venue_slug', venueSlugs)
  const { data, error } = await q
  if (error || !data) return tableMissing(error) ? null : []
  const offers = data as any[]
  if (offers.length === 0) return []
  const { data: made } = await db.from('bookings').select('offer_id, price_nzd, user_id, status').in('offer_id', offers.map(o => o.id)).eq('status', 'confirmed')
  const rows: OfferRow[] = []
  for (const o of offers) {
    const mine = ((made ?? []) as any[]).filter(b => b.offer_id === o.id)
    const courts = await venueCourts(db, o.venue_slug)
    const userIds = Array.from(new Set(mine.map(b => b.user_id).filter(Boolean)))
    let returning = new Set<string>()
    if (userIds.length > 0 && courts.length > 0) {
      const { data: before } = await db.from('bookings').select('user_id, offer_id').in('user_id', userIds).in('court_id', courts.map(c => c.id)).lt('created_at', o.created_at)
      returning = new Set(((before ?? []) as any[]).filter(b => !b.offer_id).map(b => b.user_id as string))
    }
    const newIds = new Set(userIds.filter(id => !returning.has(id as string)) as string[])
    rows.push({
      ...o,
      results: summariseOffer(o.discount_percent, mine, newIds),
      ended: o.status === 'cancelled' || Date.parse(o.closes_at) <= nowMs,
    })
  }
  return rows
}
