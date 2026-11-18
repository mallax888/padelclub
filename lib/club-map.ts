// The numbers behind "Your club right now" on Today: who is on each court at any time of day, the wording that
// compares today with the same weekday last week, and the plain-English line about what is left to sell. Pure
// functions of their inputs (the clock is passed in), so the cases that matter are tested without a browser.
import { fmtClockRange, fmtMinutes } from '@/lib/clock'
import type { CourtDayRow } from '@/lib/court-day'

const pad = (n: number) => String(n).padStart(2, '0')

export type MapBooking = {
  id: string
  courtId: string
  start: number // minutes since midnight
  end: number
  status: string
  who: string | null // the person who booked
  people: string[] // the booker first, then the friends who have joined
  unpaid: number
}
export type CourtAt = {
  state: 'playing' | 'free' | 'blocked'
  who: string | null
  people: string[]
  until: number | null
  next: { start: number; who: string | null } | null
}

export const hhmm = (m: number): string => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
export function clock12(m: number): string {
  return fmtMinutes(m)
}
export function initialsOf(name: string | null | undefined): string {
  const w = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (w.length === 0) return '?'
  return (w[0][0] + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase()
}

const live = (b: MapBooking) => b.status !== 'cancelled'

// What a court is doing at a given minute of the day.
export function courtAt(bookings: MapBooking[], courtId: string, minute: number): CourtAt {
  const mine = bookings.filter(b => b.courtId === courtId && live(b)).sort((a, b) => a.start - b.start)
  const cur = mine.find(b => b.start <= minute && b.end > minute)
  if (cur) {
    return cur.status === 'blocked'
      ? { state: 'blocked', who: null, people: [], until: cur.end, next: null }
      : { state: 'playing', who: cur.who, people: cur.people, until: cur.end, next: null }
  }
  const nxt = mine.find(b => b.status !== 'blocked' && b.start > minute)
  return { state: 'free', who: null, people: [], until: null, next: nxt ? { start: nxt.start, who: nxt.who } : null }
}

// The bookings still to start on a court after a given minute.
export const nextBookings = (bookings: MapBooking[], courtId: string, minute: number, limit = 3): MapBooking[] =>
  bookings.filter(b => b.courtId === courtId && live(b) && b.status !== 'blocked' && b.start > minute).sort((a, b) => a.start - b.start).slice(0, limit)

export const WEEKDAY_LONG: Record<string, string> = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' }

// "5 more than last Tuesday": counts of bookings, never percentages or points.
export function comparison(diff: number, weekdayShort: string): string {
  const day = WEEKDAY_LONG[weekdayShort] ?? weekdayShort
  return diff === 0 ? `the same as last ${day}` : `${Math.abs(diff)} ${diff > 0 ? 'more' : 'fewer'} than last ${day}`
}
export const bookingsWord = (n: number) => `${n} ${n === 1 ? 'booking' : 'bookings'}`

// One plain sentence about what is left on a court today.
export function gapSentence(row: CourtDayRow, finished: boolean): string {
  if (finished) return 'Today is finished.'
  if (row.sellable === 0) return 'It is not on sale today.'
  if (row.openNow === 0) return 'It is full from now on.'
  const r = row.openRanges.map(g => fmtClockRange(g.from, g.to))
  if (r.length === 1) return `The only gap left is ${r[0]}.`
  return `There are ${r.length} gaps left: ${r.length === 2 ? r.join(' and ') : `${r.slice(0, -1).join(', ')} and ${r[r.length - 1]}`}.`
}

// The quick-pick times under the slider: the next few busy hours still to come.
export function slotChips(nowMinutes: number, firstHour: number, endHour: number): number[] {
  const next = Math.floor(nowMinutes / 60) + 1
  return Array.from(new Set([next, 17, 18, 19, 20, 21])).filter(h => h * 60 > nowMinutes && h >= firstHour && h < endHour).sort((a, b) => a - b).slice(0, 4).map(h => h * 60)
}
