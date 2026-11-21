// Server side of weekly regulars (see supabase/migrations/027_regulars.sql):
// setting a regular up, stopping one, and the two things the unpaid-booking cron
// does for held weeks -- remind, then release. The rules live in
// lib/regulars-rules.ts so the booking screen, this file and My bookings agree.
import { clockAt, fmtClock } from '@/lib/clock'
import type { SupabaseClient } from '@supabase/supabase-js'
import { VENUES } from '@/lib/venues'
import { timezoneForVenueSlug, venueInstant } from '@/lib/timezone'
import { computeCourtPrice } from '@/lib/pricing'
import { memberDiscount } from '@/lib/plan-rules'
import { loadPlanRows } from '@/lib/club-plans'
import { dayHours } from '@/lib/venue-hours'
import { loadVenueSettings, isOpenForBooking, weekFor } from '@/lib/venue-settings'
import { sendPushToUser } from '@/lib/push'
import { applyCancellationRefund } from '@/lib/cancellation'
import { notifyWaitlistForBookings } from '@/lib/waitlist'
import { formatDate } from '@/lib/utils'
import { reportMoneyIssue } from '@/lib/report'
import { friendShareCents } from '@/lib/share-rules'
import { currencyForRegion, formatPrice } from '@/lib/currency'
import { hhmm } from '@/lib/waitlist-rules'
import {
  MAX_ACTIVE_REGULARS, MIN_SKIP_HOURS, WEEK_OPTIONS, payByFor, planWeeks, releaseDue, reminderDue, seriesDates, weekdayPlural,
  type DatedBusy, type WeekReason,
} from '@/lib/regulars-rules'

type Admin = SupabaseClient<any>

export const tableMissing = (error: any): boolean =>
  !!error && (error.code === '42P01' || error.code === 'PGRST205' || /(does not exist|schema cache)/i.test(String(error.message ?? '')))
// "That column isn't there": the database change hasn't been run.
export const columnMissing = (error: any): boolean =>
  !!error && (error.code === '42703' || error.code === 'PGRST204' || /column .* does not exist|could not find .* column/i.test(String(error.message ?? '')))

export type RegularRules = { enabled: boolean; peakCap: number | null }
export type RegularRulesMap = Record<string, RegularRules>

// Club rules for regulars. No row means allowed with no limit, and so does a
// settings table that isn't there yet.
export async function loadRegularRules(db: any): Promise<RegularRulesMap> {
  const { data, error } = await db.from('regular_settings').select('venue_slug, enabled, peak_court_cap')
  if (error || !data) return {}
  const map: RegularRulesMap = {}
  for (const r of data as any[]) map[r.venue_slug] = { enabled: r.enabled !== false, peakCap: typeof r.peak_court_cap === 'number' ? r.peak_court_cap : null }
  return map
}

const numericName = (a: { name?: string }, b: { name?: string }) => String(a.name ?? '').localeCompare(String(b.name ?? ''), undefined, { numeric: true })

export type CreateResult =
  | { ok: true; regularId: string | null; booked: string[]; clashes: { date: string; reason: WeekReason }[] }
  | { ok: false; status: number; error: string }
const fail = (status: number, error: string): CreateResult => ({ ok: false, status, error })

// The first week is the booking the player has just made (they are on their way
// to pay for it). This books the rest of the series around it: each later week
// gets the lowest free court of the same type, or is skipped with a reason.
export async function createRegularWeeks(admin: Admin, input: { userId: string; firstBookingId: string; weeks: number; skipDates?: string[]; splitPlayerIds?: string[]; nowMs?: number }): Promise<CreateResult> {
  const nowMs = input.nowMs ?? Date.now()
  const db: any = admin
  if (!(WEEK_OPTIONS as readonly number[]).includes(input.weeks)) return fail(400, 'Choose 4, 8 or 12 weeks.')

  const { data: first } = await db.from('bookings')
    .select('id, user_id, court_id, date, start_time, duration_minutes, status, regular_id, courts(id, venue_slug, type)')
    .eq('id', input.firstBookingId).maybeSingle()
  if (!first || first.user_id !== input.userId) return fail(404, 'We could not find that booking.')
  if (first.status !== 'confirmed') return fail(400, 'Only a confirmed booking can become a regular.')
  if (first.regular_id) return fail(400, 'That booking is already part of a regular.')
  const slug: string | undefined = first.courts?.venue_slug
  if (!slug || !VENUES.some(v => v.slug === slug)) return fail(400, 'We could not find that club.')
  const tz = timezoneForVenueSlug(slug)
  const startTime = hhmm(first.start_time)
  const durationMin: number = first.duration_minutes ?? 60
  if (venueInstant(first.date, `${startTime}:00`, tz).getTime() <= nowMs) return fail(400, 'That time has already started.')

  const settings = await loadVenueSettings(db)
  if (!isOpenForBooking(settings, slug)) return fail(400, "This club isn't open for booking yet.")
  const rules = (await loadRegularRules(db))[slug]
  if (rules && !rules.enabled) return fail(403, 'This club has switched regulars off.')

  const { data: mine, error: mineError } = await db.from('regulars').select('id').eq('user_id', input.userId).eq('status', 'active')
  if (tableMissing(mineError) || columnMissing(mineError)) return fail(503, "Regulars aren't switched on yet.")
  if (mineError) return fail(500, 'Could not set up your regular. Please try again.')
  if ((mine ?? []).length >= MAX_ACTIVE_REGULARS) return fail(400, `You can have up to ${MAX_ACTIVE_REGULARS} regulars at once. Stop one first.`)

  const { data: venueCourts } = await db.from('courts').select('id, name, type, price_per_hour, price_per_hour_peak, is_active').eq('venue_slug', slug).eq('is_active', true)
  const allCourts = ((venueCourts ?? []) as any[]).sort(numericName)
  const courtType: string | null = first.courts?.type ?? null
  const courts = allCourts.filter(c => (c.type ?? null) === courtType)
  // The later weeks try the first week's court first, so a regular who chose Court 2 keeps Court 2 whenever it is free.
  const firstAt = courts.findIndex(c => c.id === first.court_id)
  if (firstAt > 0) courts.unshift(...courts.splice(firstAt, 1))
  if (courts.length === 0) return fail(400, 'That club has no courts of that type.')

  const dates = seriesDates(first.date, input.weeks).slice(1)
  const { data: busyRows } = await db.from('bookings')
    .select('court_id, date, start_time, duration_minutes, status, regular_id')
    .in('court_id', allCourts.map(c => c.id)).in('date', dates).in('status', ['confirmed', 'blocked'])
  const busy: DatedBusy[] = ((busyRows ?? []) as any[]).map(b => ({ court_id: b.court_id, date: b.date, start_time: b.start_time, duration_minutes: b.duration_minutes, regular: !!b.regular_id && b.status === 'confirmed' }))

  const week = weekFor(settings, slug)
  const plan = planWeeks({
    dates, startTime, durationMin, courts, busy, peakCap: rules?.peakCap ?? null,
    hoursFor: d => dayHours(week, d),
    startsInFuture: d => venueInstant(d, `${startTime}:00`, tz).getTime() > nowMs,
  })
  if (plan.every(p => !p.court || (input.skipDates ?? []).includes(p.date))) {
    return { ok: true, regularId: null, booked: [], clashes: plan.map(p => ({ date: p.date, reason: p.reason as WeekReason })) }
  }

  const { data: series, error: seriesError } = await db.from('regulars').insert({
    user_id: input.userId, venue_slug: slug, court_type: courtType, start_time: `${startTime}:00`, duration_minutes: durationMin,
    start_date: first.date, weeks: input.weeks, clash_dates: [], status: 'active',
  }).select('id').single()
  if (tableMissing(seriesError) || columnMissing(seriesError)) return fail(503, "Regulars aren't switched on yet.")
  if (seriesError || !series) return fail(500, 'Could not set up your regular. Please try again.')

  const { data: profile } = await db.from('profiles').select('membership_tier, home_venue_slug').eq('id', input.userId).maybeSingle()
  const planRows = profile?.home_venue_slug ? await loadPlanRows(db, [profile.home_venue_slug]) : null
  const discount = memberDiscount(planRows, { tier: profile?.membership_tier, homeSlug: profile?.home_venue_slug ?? null, bookingSlug: slug })
  const endOf = (t: string, mins: number) => { const m = Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) + mins; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:00` }

  // Friends who share every week (the "split every week" option): real, other players, at most three.
  const wantFriends = Array.from(new Set((input.splitPlayerIds ?? []).filter(id => typeof id === 'string' && id !== input.userId))).slice(0, 3)
  let friends: string[] = []
  if (wantFriends.length > 0) {
    const { data: found } = await db.from('profiles').select('id').in('id', wantFriends)
    friends = ((found ?? []) as any[]).map(f => f.id as string)
  }
  const splitWeeks: string[] = []

  const booked: string[] = []
  const clashes: { date: string; reason: WeekReason }[] = []
  // Weeks the player chose to skip are simply not booked (and not "taken").
  const skip = new Set(input.skipDates ?? [])
  for (const p of plan) {
    if (skip.has(p.date)) continue
    if (!p.court) { clashes.push({ date: p.date, reason: p.reason as WeekReason }); continue }
    const price = parseFloat(computeCourtPrice(p.court as any, p.date, startTime, durationMin / 60, discount).toFixed(2))
    const { data: inserted, error } = await db.from('bookings').insert({
      user_id: input.userId, court_id: p.court.id, date: p.date, start_time: `${startTime}:00`, end_time: endOf(startTime, durationMin),
      duration_minutes: durationMin, status: 'confirmed', payment_method: 'card', discount_applied: discount,
      price_nzd: price,
      regular_id: series.id, pay_by: payByFor(p.date, startTime, tz).toISOString(),
    }).select('id').single()
    // Someone else got that court between our look and our insert: that week is taken.
    if (error) { clashes.push({ date: p.date, reason: 'taken' }); if (error.code !== '23P01' && error.code !== '23505') console.error('Could not book a regular week', p.date, error); continue }
    booked.push(p.date)
    if (friends.length > 0 && inserted?.id) {
      const share = friendShareCents(price, friends.length + 1) / 100
      const { error: splitError } = await db.from('booking_splits').insert(friends.map(f => ({
        booking_id: inserted.id, invited_by: input.userId, user_id: f, amount_nzd: share, status: 'pending',
      })))
      if (splitError) console.error('Could not split a regular week', p.date, splitError)
      else splitWeeks.push(p.date)
    }
  }

  await db.from('bookings').update({ regular_id: series.id }).eq('id', first.id)
  if (clashes.length > 0) await db.from('regulars').update({ clash_dates: clashes.map(c => c.date) }).eq('id', series.id)

  if (booked.length === 0) {
    // Nothing but the first week came through: that isn't a regular.
    await db.from('bookings').update({ regular_id: null }).eq('id', first.id)
    await db.from('regulars').delete().eq('id', series.id)
    return { ok: true, regularId: null, booked: [], clashes }
  }

  if (friends.length > 0 && splitWeeks.length > 0) {
    try {
      const { data: me } = await db.from('profiles').select('full_name, nickname').eq('id', input.userId).maybeSingle()
      const myName = me?.nickname ?? me?.full_name ?? 'Someone'
      const { data: firstPrice } = await db.from('bookings').select('price_nzd').eq('id', first.id).maybeSingle()
      const share = friendShareCents(Number(firstPrice?.price_nzd) || 0, friends.length + 1) / 100
      const currency = currencyForRegion(VENUES.find(v => v.slug === slug)?.region)
      await db.from('notifications').insert(friends.map(f => ({
        user_id: f, type: 'split_request',
        message: `${myName} is splitting ${splitWeeks.length + 1} weekly games with you: about ${formatPrice(share, currency)} a week. Pay any week from My bookings.`,
      })))
    } catch { /* the splits are saved either way */ }
  }

  try {
    const message = `Your regular is set: ${weekdayPlural(first.date)} at ${startTime}. ${booked.length + 1} of ${input.weeks} weeks are booked. Each week is paid about a week before.`
    await db.from('notifications').insert({ user_id: input.userId, type: 'regular_created', message })
  } catch { /* the regular is saved either way */ }
  return { ok: true, regularId: series.id, booked, clashes }
}

// Stop a regular: unpaid weeks still to come are let go (and anyone waiting for
// them is told); weeks already paid are kept and played.
export async function stopRegular(admin: Admin, input: { userId: string; regularId: string; nowMs?: number }): Promise<{ ok: true; released: number; keptPaid: number; refunded?: number } | { ok: false; status: number; error: string }> {
  const nowMs = input.nowMs ?? Date.now()
  const db: any = admin
  const { data: series, error } = await db.from('regulars').select('id, user_id, venue_slug, status').eq('id', input.regularId).maybeSingle()
  if (tableMissing(error)) return { ok: false, status: 503, error: "Regulars aren't switched on yet." }
  if (!series || series.user_id !== input.userId) return { ok: false, status: 404, error: 'We could not find that regular.' }
  if (series.status === 'stopped') return { ok: true, released: 0, keptPaid: 0, refunded: 0 }

  await db.from('regulars').update({ status: 'stopped', stopped_at: new Date(nowMs).toISOString() }).eq('id', series.id)
  const tz = timezoneForVenueSlug(series.venue_slug)
  const { data: weeks } = await db.from('bookings')
    .select('id, user_id, court_id, date, start_time, price_nzd, stripe_payment_id, payment_method, status')
    .eq('regular_id', series.id).eq('status', 'confirmed')
  const future = ((weeks ?? []) as any[]).filter(b => venueInstant(b.date, `${hhmm(b.start_time)}:00`, tz).getTime() > nowMs)
  const unpaid = future.filter(b => !b.stripe_payment_id)
  const ids: string[] = []
  for (const b of unpaid) {
    const { data: cancelled } = await db.from('bookings').update({ status: 'cancelled' }).eq('id', b.id).eq('status', 'confirmed').select('id').maybeSingle()
    if (!cancelled) continue
    ids.push(b.id)
    try { await applyCancellationRefund(admin as any, b, { byStaff: true }) } catch (err) {
      reportMoneyIssue('Could not unwind a stopped regular week', { bookingId: b.id, error: err instanceof Error ? err.message : String(err) })
    }
  }
  // Weeks paid for in advance (as one payment covering several) are given back, each its
  // own slice, as long as they are still a day or more away. Weeks played within the
  // next day are kept, like any other paid week.
  const paidFuture = future.filter(b => b.stripe_payment_id)
  let refunded = 0
  if (paidFuture.length > 0) {
    const { data: slices, error: sliceError } = await db.from('bookings').select('id, paid_cents').in('id', paidFuture.map(b => b.id))
    const prepaid = new Set(!sliceError ? ((slices ?? []) as any[]).filter(r => r.paid_cents).map(r => r.id as string) : [])
    for (const b of paidFuture) {
      if (!prepaid.has(b.id)) continue
      if (venueInstant(b.date, `${hhmm(b.start_time)}:00`, tz).getTime() - nowMs < MIN_SKIP_HOURS * 3600 * 1000) continue
      const { data: cancelled } = await db.from('bookings').update({ status: 'cancelled' }).eq('id', b.id).eq('status', 'confirmed').select('id').maybeSingle()
      if (!cancelled) continue
      ids.push(b.id)
      refunded++
      try { await applyCancellationRefund(admin as any, b) } catch (err) {
        reportMoneyIssue('Could not refund a prepaid week of a stopped regular', { bookingId: b.id, error: err instanceof Error ? err.message : String(err) })
      }
    }
  }
  await notifyWaitlistForBookings(admin, ids)
  return { ok: true, released: ids.length - refunded, keptPaid: future.length - unpaid.length - refunded, refunded }
}

const fmtPayBy = (iso: string, tz: string): string =>
  `${new Intl.DateTimeFormat('en-NZ', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso))}, ${clockAt(iso, tz)}`

// Held weeks nobody paid for by their deadline go back on sale. Returns how many.
export async function releaseOverdueRegularWeeks(admin: Admin, nowMs: number = Date.now()): Promise<number> {
  const db: any = admin
  const { data, error } = await db.from('bookings')
    .select('id, user_id, court_id, date, start_time, price_nzd, stripe_payment_id, payment_method, pay_by, courts(venue_slug)')
    .eq('status', 'confirmed').eq('payment_method', 'card').is('stripe_payment_id', null)
  if (error || !data) return 0
  const due = (data as any[]).filter(b => b.pay_by && releaseDue(b.pay_by, nowMs))
  const released: string[] = []
  for (const b of due) {
    const { data: cancelled } = await db.from('bookings').update({ status: 'cancelled' }).eq('id', b.id).eq('status', 'confirmed').select('id').maybeSingle()
    if (!cancelled) continue
    released.push(b.id)
    try { await applyCancellationRefund(admin as any, b, { byStaff: true }) } catch (err) {
      reportMoneyIssue('Could not unwind a released regular week', { bookingId: b.id, error: err instanceof Error ? err.message : String(err) })
    }
    try {
      const tz = timezoneForVenueSlug(b.courts?.venue_slug)
      const message = `Your ${formatDate(b.date)}, ${fmtClock(b.start_time)} court was released because it wasn't paid by ${fmtPayBy(b.pay_by, tz)}. Your regular carries on with the other weeks.`
      await db.from('notifications').insert({ user_id: b.user_id, type: 'booking_released', message })
    } catch { /* best effort */ }
  }
  if (released.length > 0) {
    await db.from('open_matches').update({ status: 'cancelled' }).in('booking_id', released).eq('status', 'open')
    await notifyWaitlistForBookings(admin, released)
  }
  return released.length
}

// One reminder per held week, once it is within a week of play and unpaid.
export async function sendRegularReminders(admin: Admin, nowMs: number = Date.now()): Promise<number> {
  const db: any = admin
  const { data, error } = await db.from('bookings')
    .select('id, user_id, date, start_time, pay_by, pay_reminded_at, courts(venue_slug)')
    .eq('status', 'confirmed').eq('payment_method', 'card').is('stripe_payment_id', null)
  if (error || !data) return 0
  let sent = 0
  for (const b of data as any[]) {
    if (!b.pay_by || b.pay_reminded_at) continue
    const tz = timezoneForVenueSlug(b.courts?.venue_slug)
    if (!reminderDue(venueInstant(b.date, `${hhmm(b.start_time)}:00`, tz).getTime(), nowMs, b.pay_reminded_at)) continue
    // Claim it first so two overlapping cron runs can't both send it.
    const { data: claimed } = await db.from('bookings').update({ pay_reminded_at: new Date(nowMs).toISOString() }).eq('id', b.id).is('pay_reminded_at', null).select('id').maybeSingle()
    if (!claimed) continue
    const message = `Your regular on ${formatDate(b.date)}, ${fmtClock(b.start_time)} needs paying by ${fmtPayBy(b.pay_by, tz)}. Tap to pay.`
    try {
      await db.from('notifications').insert({ user_id: b.user_id, type: 'regular_payment', message })
      await sendPushToUser(admin as any, b.user_id, { title: 'Pay for your regular', body: message, url: '/mybookings' })
      sent++
    } catch { /* best effort */ }
  }
  return sent
}

// Whether paying a regular's weeks in advance is switched on: it needs the column that
// remembers each week's slice of a shared payment (036_regular_prepay.sql).
export async function prepayReady(admin: Admin): Promise<boolean> {
  const { error } = await (admin as any).from('bookings').select('paid_cents').limit(1)
  return !error
}
