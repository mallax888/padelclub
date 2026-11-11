// Server side of the waitlist (see supabase/migrations/026_waitlist.sql): telling
// people when a full time opens up, and the demand figures for owners. The rules
// themselves live in lib/waitlist-rules.ts. Everything here is best effort: a
// waitlist problem must never get in the way of the cancellation, release or
// reschedule that triggered it.
import type { SupabaseClient } from '@supabase/supabase-js'
import { VENUES, getVenue } from '@/lib/venues'
import { formatDate } from '@/lib/utils'
import { timezoneForVenueSlug, venueInstant } from '@/lib/timezone'
import { sendPushToUser } from '@/lib/push'
import { isMissingTable } from '@/lib/venue-settings'
import {
  aggregateDemand, hhmm, isSlotFull, overlaps, toMin, waitsWorthChecking, DEMAND_DAYS,
  type DemandBooking, type WaitDemand, type WaitRow,
} from '@/lib/waitlist-rules'

export type FreedSlot = { courtId: string; date: string; startTime: string; durationMinutes: number | null }

// Tell everyone waiting for a time that this freed court-time makes bookable.
// Returns how many people were told.
export async function notifyWaitlistForSlot(admin: SupabaseClient<any>, slot: FreedSlot, nowMs: number = Date.now()): Promise<number> {
  try {
    const db: any = admin
    const { data: court } = await db.from('courts').select('venue_slug').eq('id', slot.courtId).maybeSingle()
    const venueSlug: string | undefined = court?.venue_slug
    if (!venueSlug) return 0

    const tz = timezoneForVenueSlug(venueSlug)
    const dur = slot.durationMinutes ?? 60
    // Court-time that is already over can't be booked, so there is nobody to tell.
    if (venueInstant(slot.date, `${hhmm(slot.startTime)}:00`, tz).getTime() + dur * 60000 <= nowMs) return 0

    const { data: rows, error } = await db.from('waitlist').select('*').eq('venue_slug', venueSlug).eq('date', slot.date).in('status', ['waiting', 'notified'])
    if (error || !rows || rows.length === 0) return 0

    const candidates = waitsWorthChecking(rows as WaitRow[], { venueSlug, date: slot.date, startMin: toMin(slot.startTime), durationMin: dur }, nowMs)
      .filter(w => venueInstant(w.date, `${hhmm(w.start_time)}:00`, tz).getTime() > nowMs)
    if (candidates.length === 0) return 0

    const { data: courts } = await db.from('courts').select('id').eq('venue_slug', venueSlug).eq('is_active', true)
    const courtIds = ((courts ?? []) as any[]).map(c => c.id as string)
    if (courtIds.length === 0) return 0
    const { data: busyRows } = await db.from('bookings').select('court_id, user_id, start_time, duration_minutes')
      .in('court_id', courtIds).eq('date', slot.date).in('status', ['confirmed', 'blocked'])
    const busy = (busyRows ?? []) as { court_id: string; user_id: string | null; start_time: string; duration_minutes: number | null }[]

    const venue = getVenue(venueSlug)
    let told = 0
    for (const w of candidates) {
      const startMin = toMin(w.start_time)
      // Somebody else may have grabbed it already, or the court that opened is only free for part of what they wanted.
      if (isSlotFull(courtIds, busy, startMin, w.duration_minutes)) continue
      // They already have a court then (they found one another way).
      if (busy.some(b => b.user_id === w.user_id && overlaps(toMin(b.start_time), b.duration_minutes ?? 60, startMin, w.duration_minutes))) continue

      // Claim it first, so two cancellations at once can't tell the same person twice.
      const { data: claimed } = await db.from('waitlist')
        .update({ status: 'notified', notified_at: new Date(nowMs).toISOString() })
        .eq('id', w.id).eq('status', w.status).select('id').maybeSingle()
      if (!claimed) continue
      told++

      const message = `A court just opened at ${venue.name} on ${formatDate(w.date)}, ${hhmm(w.start_time)}. Tap to book it before someone else does.`
      const { error: nError } = await db.from('notifications').insert({ user_id: w.user_id, type: 'waitlist_open', message })
      if (nError) console.error('Could not create waitlist notification', w.user_id, nError)
      try {
        await sendPushToUser(admin as any, w.user_id, { title: 'A court just opened up', body: message, url: '/book?wl=1' })
      } catch (err) {
        console.error('Could not push waitlist notification', w.user_id, err)
      }
    }
    return told
  } catch (err) {
    console.error('Waitlist notify failed', err)
    return 0
  }
}

// For the routes that cancel or release whole bookings: look the booking(s) up
// and tell the waiters for each freed slot.
export async function notifyWaitlistForBookings(admin: SupabaseClient<any>, bookingIds: string[]): Promise<void> {
  try {
    if (bookingIds.length === 0) return
    const { data } = await (admin as any).from('bookings').select('court_id, date, start_time, duration_minutes').in('id', bookingIds)
    for (const b of (data ?? []) as any[]) {
      await notifyWaitlistForSlot(admin, { courtId: b.court_id, date: b.date, startTime: b.start_time, durationMinutes: b.duration_minutes })
    }
  } catch (err) {
    console.error('Waitlist notify (bookings) failed', err)
  }
}

// Owners: per club, how many people waited in the last two weeks, how many then
// booked, and the times people most often can't get. null = the table isn't there yet.
export async function loadWaitlistDemand(admin: SupabaseClient<any>, venueSlugs: string[] | null, nowMs: number = Date.now()): Promise<Record<string, WaitDemand> | null> {
  const db: any = admin
  const since = new Date(nowMs - DEMAND_DAYS * 24 * 3600 * 1000).toISOString()
  let q = db.from('waitlist').select('*').gte('created_at', since).limit(5000)
  if (venueSlugs) q = q.in('venue_slug', venueSlugs)
  const { data, error } = await q
  if (isMissingTable(error) || error?.code === '42P01' || error?.code === 'PGRST205' || /waitlist/.test(String(error?.message ?? ''))) return null
  if (error) return null
  const waits = (data ?? []) as WaitRow[]

  // Bookings made by people who were told, to see who then booked.
  const toldUsers = Array.from(new Set(waits.filter(w => w.notified_at).map(w => w.user_id)))
  let bookings: DemandBooking[] = []
  if (toldUsers.length > 0) {
    const dates = Array.from(new Set(waits.filter(w => w.notified_at).map(w => w.date)))
    const { data: rows } = await db.from('bookings').select('user_id, date, start_time, duration_minutes, created_at, status, courts(venue_slug)')
      .in('user_id', toldUsers).in('date', dates)
    bookings = ((rows ?? []) as any[]).map(b => ({ user_id: b.user_id, court_venue: b.courts?.venue_slug ?? '', date: b.date, start_time: b.start_time, duration_minutes: b.duration_minutes, created_at: b.created_at, status: b.status }))
  }

  const out: Record<string, WaitDemand> = {}
  for (const slug of Array.from(new Set(waits.map(w => w.venue_slug)))) {
    out[slug] = aggregateDemand(waits.filter(w => w.venue_slug === slug), bookings.filter(b => b.court_venue === slug), nowMs)
  }
  return out
}

export const knownVenue = (slug: unknown): slug is string => typeof slug === 'string' && VENUES.some(v => v.slug === slug)
