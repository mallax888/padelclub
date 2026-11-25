// The money colour rule, in one place so every screen agrees:
//   green = money made / in, red = money lost, out or overdue, blue = waiting or a chance (count figures are blue too),
//   grey = a figure set by hand. Lime is only ever a button.
// The arrow on a change shows what happened to the manager's money: up (green) is more money, down (red) is less.
// So refunds or cancellations rising is a red down arrow.
import { addDays, format, parseISO } from 'date-fns'

export type MoneyKind = 'gain' | 'loss' | 'wait' | 'none'
export const MONEY_HEX: Record<MoneyKind, string> = { gain: '#1f9a5f', loss: '#c4343a', wait: '#2f6fd6', none: '#4a535d' }

// What colour a booking's amount wears: paid is green, cancelled is red, pending is blue, a blocked slot has no money.
export function bookingKind(status: string): MoneyKind {
  if (status === 'confirmed' || status === 'completed') return 'gain'
  if (status === 'cancelled') return 'loss'
  if (status === 'pending') return 'wait'
  return 'none'
}

// A change in money: more is green with an up arrow, less is red with a down arrow. Null when nothing moved or there is nothing to compare.
export function moneyChange(pct: number | null | undefined): { kind: MoneyKind; arrow: '▲' | '▼' | ''; text: string } | null {
  if (pct === null || pct === undefined || !Number.isFinite(pct) || pct === 0) return null
  return pct > 0 ? { kind: 'gain', arrow: '▲', text: `${Math.abs(pct)}%` } : { kind: 'loss', arrow: '▼', text: `${Math.abs(pct)}%` }
}
// A change in a count (bookings, players, utilisation): the arrow follows the number, the colour stays blue.
export function countChange(pct: number | null | undefined): { kind: MoneyKind; arrow: '▲' | '▼' | ''; text: string } | null {
  const c = moneyChange(pct)
  return c ? { ...c, kind: 'wait' } : null
}
// Money going out (refunds, cancellations): a rise is less money for the manager, so a red down arrow; a fall is a green up arrow.
export function outflowChange(pct: number | null | undefined): { kind: MoneyKind; arrow: '▲' | '▼' | ''; text: string } | null {
  if (pct === null || pct === undefined || !Number.isFinite(pct) || pct === 0) return null
  return pct > 0 ? { kind: 'loss', arrow: '▼', text: `${Math.abs(pct)}%` } : { kind: 'gain', arrow: '▲', text: `${Math.abs(pct)}%` }
}

// Monday to Sunday of the week containing the given day.
export function weekRange(todayStr: string): { from: string; to: string } {
  const d = parseISO(todayStr)
  const back = (d.getDay() + 6) % 7
  const from = addDays(d, -back)
  return { from: format(from, 'yyyy-MM-dd'), to: format(addDays(from, 6), 'yyyy-MM-dd') }
}

export type WeekBooking = { date: string; status: string; price_nzd: number; refund_cents?: number | null; refund_kind?: string | null }
const round2 = (n: number) => Math.round(n * 100) / 100

// Bookings this week: what was taken (paid, still standing) and what went back (card refunds and account credit; a session credit is
// not money). Cancelling a paid booking moves it out of "taken" and into "refunded" by what was actually given back.
export function weekMoney(bookings: WeekBooking[], todayStr: string): { taken: number; refunded: number } {
  const { from, to } = weekRange(todayStr)
  let taken = 0, refunded = 0
  for (const b of bookings) {
    if (b.date < from || b.date > to) continue
    if (b.status === 'confirmed' || b.status === 'completed') taken += Number(b.price_nzd) || 0
    if (b.status === 'cancelled' && b.refund_kind && b.refund_kind !== 'session') refunded += (Number(b.refund_cents) || 0) / 100
  }
  return { taken: round2(taken), refunded: round2(refunded) }
}
