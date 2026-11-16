// Paying for a regular's weeks in one go, as pure functions (client-safe).
//
// One card payment can cover several weeks of the same regular. Each week keeps
// its own slice of that payment (bookings.paid_cents), so skipping one week, or
// stopping the regular, gives back exactly that week's slice and leaves the rest.
import { bookerShareCents } from '@/lib/share-rules'

export type PrepayWeek = { bookingId: string; date: string; cents: number }

// A regular is at most 12 weeks, so a payment is at most 12 slices.
export const MAX_PREPAY_WEEKS = 12

// What the booker pays for one week: the whole fee, or their share when friends
// are splitting it (friend rows already on that week, plus the booker).
export const weekCents = (price: number, friendRows: number): number => bookerShareCents(price, friendRows + 1)

export const prepayTotalCents = (weeks: { cents: number }[]): number => weeks.reduce((sum, w) => sum + w.cents, 0)

// Stripe metadata allows 500 characters a value, so the slices ride in one key
// each ("p0" ... "p11"): "<booking id>:<cents>".
export function encodeParts(weeks: { bookingId: string; cents: number }[]): Record<string, string> {
  const out: Record<string, string> = {}
  weeks.slice(0, MAX_PREPAY_WEEKS).forEach((w, i) => { out[`p${i}`] = `${w.bookingId}:${w.cents}` })
  return out
}

export function decodeParts(metadata: Record<string, string | undefined> | null | undefined): { bookingId: string; cents: number }[] {
  const out: { bookingId: string; cents: number }[] = []
  for (let i = 0; i < MAX_PREPAY_WEEKS; i++) {
    const raw = metadata?.[`p${i}`]
    if (!raw) continue
    const at = raw.lastIndexOf(':')
    const bookingId = raw.slice(0, at)
    const cents = Number(raw.slice(at + 1))
    if (at > 0 && bookingId && Number.isInteger(cents) && cents > 0) out.push({ bookingId, cents })
  }
  return out
}

// "N weeks" in plain words for a notification or a button.
export const weeksPhrase = (n: number): string => (n === 1 ? '1 week' : `${n} weeks`)
