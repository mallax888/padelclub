// Server side of the unpaid-share deadline (see supabase/migrations/028_share_deadline.sql
// and lib/share-rules.ts): after the deadline the booker is asked to cover what is
// still unpaid, and if they don't in time the court is released and everyone who
// paid is refunded. Everything here is best effort around the cron that calls it:
// one booking's trouble must not stop the rest.
import type { SupabaseClient } from '@supabase/supabase-js'
import { timezoneForVenueSlug, venueInstant } from '@/lib/timezone'
import { currencyForVenueSlug, formatPrice } from '@/lib/currency'
import { formatDate } from '@/lib/utils'
import { sendPushToUser } from '@/lib/push'
import { applyCancellationRefund } from '@/lib/cancellation'
import { notifyWaitlistForBookings } from '@/lib/waitlist'
import { reportMoneyIssue } from '@/lib/report'
import { hhmm } from '@/lib/waitlist-rules'
import { coverCents, releaseAllowed, RELEASE_GRACE_HOURS, shareSchedule, shareStage, unpaidShares } from '@/lib/share-rules'

type Admin = SupabaseClient<any>
const firstName = (p: any) => p?.nickname ?? p?.full_name?.split(' ')[0] ?? null

const missingColumn = (error: any): boolean =>
  !!error && (error.code === '42703' || error.code === 'PGRST204' || /column .* does not exist|could not find .* column/i.test(String(error.message ?? '')))

// Has the share-deadline database change been run?
export async function shareDeadlineReady(admin: Admin): Promise<boolean> {
  const { error } = await (admin as any).from('booking_splits').select('covered_by').limit(1)
  return !error
}

const fmtWhen = (ms: number, tz: string) =>
  new Intl.DateTimeFormat('en-NZ', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ms))

// Release a booking because shares were still unpaid after the cover window.
// Everyone who paid, the booker included, is refunded in full (it is the club's
// call, not theirs), unpaid shares are withdrawn, and the waitlist is told.
export async function releaseForUnpaidShares(admin: Admin, booking: any, unpaidCount: number): Promise<boolean> {
  const db: any = admin
  const { data: cancelled } = await db.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id).eq('status', 'confirmed').select('id').maybeSingle()
  if (!cancelled) return false
  try {
    const result = await applyCancellationRefund(admin as any, booking, { byStaff: true })
    if (result.refundFailed) reportMoneyIssue('Refund failed while releasing a court over unpaid shares', { bookingId: booking.id })
  } catch (err) {
    reportMoneyIssue('Could not unwind payments for a court released over unpaid shares', { bookingId: booking.id, error: err instanceof Error ? err.message : String(err) })
  }
  await db.from('open_matches').update({ status: 'cancelled' }).eq('booking_id', booking.id).eq('status', 'open')
  await notifyWaitlistForBookings(admin, [booking.id])

  try {
    const { data: paid } = await db.from('booking_splits').select('user_id').eq('booking_id', booking.id).in('status', ['paid', 'refunded'])
    const who = new Set<string>([booking.user_id, ...((paid ?? []) as any[]).map(p => p.user_id).filter(Boolean)])
    const message = `Your ${formatDate(booking.date)}, ${hhmm(booking.start_time)} court was released because ${unpaidCount === 1 ? 'a share was' : `${unpaidCount} shares were`} not paid in time. Everyone who had paid is being refunded in full.`
    await db.from('notifications').insert(Array.from(who).map(user_id => ({ user_id, type: 'booking_released', message })))
  } catch { /* best effort */ }
  return true
}

// Run from the unpaid-booking cron. For every confirmed future booking with
// unpaid shares: ask the booker to cover once the deadline passes (one message),
// and release the court if the cover window ends with shares still unpaid.
export async function processShareDeadlines(admin: Admin, nowMs: number = Date.now()): Promise<{ asked: number; released: number }> {
  const db: any = admin
  const out = { asked: 0, released: 0 }
  const { data, error } = await db.from('booking_splits')
    .select('id, booking_id, user_id, amount_nzd, bookings!inner(id, user_id, court_id, date, start_time, created_at, status, price_nzd, stripe_payment_id, payment_method, share_cover_notified_at, share_deadline_exempt, courts(venue_slug, name))')
    .eq('status', 'pending')
  if (missingColumn(error) || error || !data) return out

  const byBooking = new Map<string, { booking: any; shares: any[] }>()
  for (const row of data as any[]) {
    const b = row.bookings
    if (!b || b.status !== 'confirmed' || b.share_deadline_exempt) continue
    const entry = byBooking.get(b.id) ?? { booking: b, shares: [] }
    entry.shares.push(row)
    byBooking.set(b.id, entry)
  }

  for (const { booking, shares } of Array.from(byBooking.values())) {
    try {
      const slug = booking.courts?.venue_slug
      const tz = timezoneForVenueSlug(slug)
      const startMs = venueInstant(booking.date, `${hhmm(booking.start_time)}:00`, tz).getTime()
      if (startMs <= nowMs) continue
      const sched = shareSchedule(startMs, Date.parse(booking.created_at))
      if (!sched) continue
      const stage = shareStage(sched, nowMs)
      if (stage === 'before') continue

      // The booker is always asked first. A court is only released once they have
      // had RELEASE_GRACE_HOURS since being asked, so a late cron run or a booking
      // already past its window still gives them a real chance to cover it.
      const notifiedAt = booking.share_cover_notified_at ? Date.parse(booking.share_cover_notified_at) : null
      if (notifiedAt !== null) {
        if (stage === 'release' && releaseAllowed(nowMs, startMs, notifiedAt)) {
          if (await releaseForUnpaidShares(admin, booking, shares.length)) out.released++
        }
        continue
      }
      // Claim it first so two overlapping runs can't both ask.
      const { data: claimed } = await db.from('bookings').update({ share_cover_notified_at: new Date(nowMs).toISOString() }).eq('id', booking.id).is('share_cover_notified_at', null).select('id').maybeSingle()
      if (!claimed) continue
      const coverBy = stage === 'cover' ? sched.coverUntil : nowMs + RELEASE_GRACE_HOURS * 3600 * 1000

      const ids = shares.map(s => s.user_id).filter(Boolean)
      const { data: profs } = ids.length ? await db.from('profiles').select('id, nickname, full_name').in('id', ids) : { data: [] }
      const names = shares.map(s => (s.user_id ? firstName((profs ?? []).find((p: any) => p.id === s.user_id)) : null) ?? 'A friend you invited')
      const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
      const owed = shares.reduce((sum, s) => sum + (Number(s.amount_nzd) || 0), 0)
      const message = `${list} ${names.length === 1 ? "hasn't" : "haven't"} paid their share (${formatPrice(owed, currencyForVenueSlug(slug))}). Cover it by ${fmtWhen(coverBy, tz)} or the ${formatDate(booking.date)}, ${hhmm(booking.start_time)} court is released and everyone is refunded. Tap to cover it.`
      await db.from('notifications').insert({ user_id: booking.user_id, type: 'share_cover_due', message })
      try { await sendPushToUser(admin as any, booking.user_id, { title: 'Cover the unpaid share?', body: message, url: '/mybookings' }) } catch { /* best effort */ }
      out.asked++
    } catch (err) {
      console.error('Share deadline step failed for booking', booking?.id, err)
    }
  }
  return out
}

// What covering would cost for this booking right now, worked out from the
// database rather than anything the browser says.
export async function coverQuote(admin: Admin, bookingId: string): Promise<{ price: number; cents: number; perShareCents: number; splitIds: string[]; venueSlug: string | null; booking: any } | null> {
  const db: any = admin
  const { data: booking } = await db.from('bookings').select('id, user_id, status, price_nzd, court_id, date, start_time, courts(venue_slug, name, type)').eq('id', bookingId).maybeSingle()
  if (!booking) return null
  const { data: rows } = await db.from('booking_splits').select('id, status').eq('booking_id', bookingId)
  const all = (rows ?? []) as any[]
  const unpaid = unpaidShares(all)
  const cents = coverCents(Number(booking.price_nzd), all.length, unpaid.length)
  return { price: Number(booking.price_nzd), cents, perShareCents: unpaid.length ? cents / unpaid.length : 0, splitIds: unpaid.map(r => r.id), venueSlug: booking.courts?.venue_slug ?? null, booking }
}

export type RefundFn = (paymentIntent: string, cents: number | null, key: string) => Promise<boolean>

// The booker's cover payment has gone through: mark the shares it was for as paid
// (by the booker). Safe against a retried webhook (shares already marked with this
// payment are left alone) and against the friend paying in the meantime (their
// share is paid twice, so the booker's copy of it is refunded). If the court has
// been released or cancelled meanwhile the whole payment is refunded.
export async function applyCoverPayment(
  admin: Admin,
  input: { bookingId: string; userId: string; splitIds: string[]; paymentIntent: string; sessionId: string; perShareCents: number },
  refund: RefundFn,
): Promise<{ covered: string[]; refundedShares: string[]; refundedAll: boolean }> {
  const db: any = admin
  const { data: booking } = await db.from('bookings').select('id, user_id, status').eq('id', input.bookingId).maybeSingle()
  if (!booking || booking.status !== 'confirmed' || booking.user_id !== input.userId) {
    const ok = await refund(input.paymentIntent, null, `cover-${input.sessionId}-all`)
    reportMoneyIssue('A cover payment landed for a booking that no longer holds its court', { bookingId: input.bookingId, paymentIntent: input.paymentIntent, refunded: ok })
    try {
      await db.from('notifications').insert({ user_id: input.userId, type: 'booking_released', message: ok
        ? 'That court was released before your payment went through, so we have refunded you in full. Refunds take a few days to appear on your statement.'
        : 'That court was released before your payment went through, and we could not refund you automatically. Please get in touch and we will sort it out.' })
    } catch { /* best effort */ }
    return { covered: [], refundedShares: [], refundedAll: true }
  }

  const { data: updated } = await db.from('booking_splits')
    .update({ status: 'paid', stripe_payment_id: input.paymentIntent, covered_by: input.userId })
    .eq('booking_id', input.bookingId).in('id', input.splitIds).eq('status', 'pending')
    .select('id')
  const covered = ((updated ?? []) as any[]).map(r => r.id as string)

  const rest = input.splitIds.filter(id => !covered.includes(id))
  const refundedShares: string[] = []
  if (rest.length > 0) {
    const { data: rows } = await db.from('booking_splits').select('id, stripe_payment_id').in('id', rest)
    for (const r of (rows ?? []) as any[]) {
      if (r.stripe_payment_id === input.paymentIntent) continue // an earlier delivery already applied it
      if (await refund(input.paymentIntent, input.perShareCents, `cover-${input.sessionId}-${r.id}`)) refundedShares.push(r.id)
      else reportMoneyIssue('Could not refund a share the booker covered after it had been paid', { bookingId: input.bookingId, splitId: r.id, paymentIntent: input.paymentIntent })
    }
  }
  return { covered, refundedShares, refundedAll: false }
}
