// The rules of "fill my empty courts" offers, as pure functions (client-safe, no
// server imports): which bookings an offer covers, what a booking costs under it,
// when it closes, whether a booking made under it is valid, and the owner's results.
// Used by the booking screen, the server's price check, the routes that create an
// offer and the owner's screen, so they all agree on the price.
import { overlaps, toMin, hhmm } from '@/lib/waitlist-rules'
import { venueInstant } from '@/lib/timezone'

export const OFFER_PERCENTS = [10, 20, 30] as const
export const MAX_ACTIVE_PER_CLUB = 5
export const MAX_RECIPIENTS = 500
export const PAST_PLAYER_DAYS = 60
// An offer closes this long before it starts, and can only be made at least
// MIN_LEAD_HOURS ahead, so it is always open for a while.
export const CLOSE_BEFORE_HOURS = 2
export const MIN_LEAD_HOURS = 3
export const MIN_WINDOW_MIN = 60
export const MAX_WINDOW_MIN = 240

const HOUR = 3600 * 1000

export type OfferLite = {
  id: string
  venue_slug: string
  date: string
  start_time: string
  end_time: string
  discount_percent: number
  closes_at: string
  status: string
  cancelled_at?: string | null
  created_at?: string
}

export const offerClosesAt = (date: string, startTime: string, tz: string): Date =>
  new Date(venueInstant(date, `${hhmm(startTime)}:00`, tz).getTime() - CLOSE_BEFORE_HOURS * HOUR)

// Does the offer cover a booking of this length starting then? The whole booking
// has to sit inside the offered hours.
export function offerCovers(o: Pick<OfferLite, 'venue_slug' | 'date' | 'start_time' | 'end_time'>, venueSlug: string, date: string, startMin: number, durMin: number): boolean {
  if (o.venue_slug !== venueSlug || o.date !== date) return false
  return startMin >= toMin(o.start_time) && startMin + durMin <= toMin(o.end_time)
}

// What a booking costs: the court's price with the better of the member's own
// discount and the offer, never both. Whole dollars, as every price here is.
export function priceWithOffer(basePerHour: number, hours: number, memberDiscount: number, offerPercent: number | null): { price: number; offerApplied: boolean } {
  const member = Math.round(basePerHour * (1 - memberDiscount) * hours)
  if (!offerPercent) return { price: member, offerApplied: false }
  const withOffer = Math.round(basePerHour * (1 - offerPercent / 100) * hours)
  return withOffer < member ? { price: withOffer, offerApplied: true } : { price: member, offerApplied: false }
}

// The best offer open now that covers this slot (the biggest discount wins).
export function bestOfferFor<O extends OfferLite>(offers: O[], venueSlug: string, date: string, startMin: number, durMin: number, nowMs: number): O | null {
  let best: O | null = null
  for (const o of offers) {
    if (o.status !== 'active' || Date.parse(o.closes_at) <= nowMs) continue
    if (!offerCovers(o, venueSlug, date, startMin, durMin)) continue
    if (!best || o.discount_percent > best.discount_percent) best = o
  }
  return best
}

// Was a booking validly made under this offer? Judged when the booking was made,
// not when it is paid, so paying a few minutes after the offer closes is fine.
export function offerValidForBooking(o: OfferLite | null | undefined, b: { createdAtMs: number; venueSlug: string; date: string; startMin: number; durMin: number }): boolean {
  if (!o) return false
  if (!offerCovers(o, b.venueSlug, b.date, b.startMin, b.durMin)) return false
  // It stops applying when it closes or is ended early, whichever comes first.
  // A booking made before then keeps it, even if it is paid afterwards.
  const ended = o.cancelled_at ? Math.min(Date.parse(o.closes_at), Date.parse(o.cancelled_at)) : Date.parse(o.closes_at)
  return b.createdAtMs <= ended
}

const TIME_RE = /^(?:[01]\d|2[0-3]):(?:00|30)$/
export type OfferInput = { date: string; startTime: string; endTime: string; percent: number }

// Errors in a proposed offer, or null. `open`/`close` are the club's hours that day.
export function validateOfferInput(i: OfferInput, ctx: { nowMs: number; tz: string; open: string; close: string } | null): string | null {
  if (!(OFFER_PERCENTS as readonly number[]).includes(i.percent)) return 'Choose 10, 20 or 30 percent.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.date) || !TIME_RE.test(i.startTime) || !TIME_RE.test(i.endTime)) return 'Invalid request.'
  const s = toMin(i.startTime), e = toMin(i.endTime)
  if (e - s < MIN_WINDOW_MIN) return 'An offer needs at least an hour.'
  if (e - s > MAX_WINDOW_MIN) return 'An offer can cover at most four hours.'
  if (!ctx) return 'The club is closed that day.'
  if (s < toMin(ctx.open) || e > toMin(ctx.close)) return "That's outside the club's opening hours."
  if (venueInstant(i.date, `${i.startTime}:00`, ctx.tz).getTime() - ctx.nowMs < MIN_LEAD_HOURS * HOUR) return `Offers need at least ${MIN_LEAD_HOURS} hours' notice, so players have time to book.`
  return null
}

export const offersOverlap = (a: Pick<OfferLite, 'date' | 'start_time' | 'end_time'>, b: Pick<OfferLite, 'date' | 'start_time' | 'end_time'>): boolean =>
  a.date === b.date && overlaps(toMin(a.start_time), toMin(a.end_time) - toMin(a.start_time), toMin(b.start_time), toMin(b.end_time) - toMin(b.start_time))

// What the owner sees up front: if every free court books, what that earns.
export function estimateOffer(listPricePerCourt: number[], percent: number): { listTotal: number; offerTotal: number } {
  const listTotal = listPricePerCourt.reduce((a, b) => a + b, 0)
  return { listTotal, offerTotal: Math.round(listTotal * (1 - percent / 100)) }
}

export type OfferResults = { courtsBooked: number; earned: number; givenAway: number; newPlayers: number; returning: number }
// Results for one offer from the bookings made under it. `newUserIds` are the
// players who had never booked at the club before.
export function summariseOffer(percent: number, bookings: { price_nzd: number; user_id: string | null }[], newUserIds: Set<string>): OfferResults {
  const factor = 1 - percent / 100
  let earned = 0, listed = 0
  const users = new Map<string, boolean>()
  for (const b of bookings) {
    const price = Number(b.price_nzd) || 0
    earned += price
    listed += factor > 0 ? price / factor : price
    if (b.user_id) users.set(b.user_id, newUserIds.has(b.user_id))
  }
  const flags = Array.from(users.values())
  return {
    courtsBooked: bookings.length,
    earned: Math.round(earned),
    givenAway: Math.round(listed - earned),
    newPlayers: flags.filter(Boolean).length,
    returning: flags.filter(f => !f).length,
  }
}
