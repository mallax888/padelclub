// The rules of weekly regulars, as pure functions (client-safe, no server
// imports): which dates a regular covers, which court each week gets, which
// weeks can't be booked, when an unpaid week is released, and how a regular is
// listed for the player. Used by the booking screen's preview, the route that
// creates the weeks, the cron that releases and reminds, and My bookings, so
// they all agree.
import { overlaps, toMin, hhmm } from '@/lib/waitlist-rules'
import { isPeakTime } from '@/lib/pricing'
import { venueInstant } from '@/lib/timezone'

export const WEEK_OPTIONS = [4, 8, 12] as const
export const MAX_ACTIVE_REGULARS = 3
// An unpaid held week is let go this long before play, and reminded this long
// before that. A player can skip a week up to MIN_SKIP_HOURS before it starts.
export const PAY_BY_HOURS = 48
export const REMIND_DAYS = 7
export const MIN_SKIP_HOURS = 24

const HOUR = 3600 * 1000

export const addDays = (date: string, n: number): string => {
  const t = new Date(date + 'T00:00:00Z')
  t.setUTCDate(t.getUTCDate() + n)
  return t.toISOString().slice(0, 10)
}

// The dates a regular covers: the first date, then every seven days.
export const seriesDates = (startDate: string, weeks: number): string[] =>
  Array.from({ length: weeks }, (_, i) => addDays(startDate, i * 7))

const WEEKDAYS = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays']
export const weekdayPlural = (date: string): string => WEEKDAYS[new Date(date + 'T12:00:00Z').getUTCDay()]
export const weekdaySingular = (date: string): string => weekdayPlural(date).slice(0, -1)

// ----------------------------------------------------------------- the weeks

export type RegularCourt = { id: string; type?: string | null; price_per_hour: number; price_per_hour_peak: number | null }
// A booking (or block) that makes court-time unavailable on a date. `regular` is
// true when it is a held week of someone's regular.
export type DatedBusy = { court_id: string; date: string; start_time: string; duration_minutes: number | null; regular?: boolean }

// The lowest-numbered court (the order they are given in) free for the whole
// booking on that date, so bookings cluster rather than scatter.
export function pickCourt<C extends { id: string }>(courts: C[], busy: DatedBusy[], date: string, startMin: number, durationMin: number): C | null {
  for (const c of courts) {
    const clash = busy.some(b => b.court_id === c.id && b.date === date && overlaps(toMin(b.start_time), b.duration_minutes ?? 60, startMin, durationMin))
    if (!clash) return c
  }
  return null
}

export type WeekReason = 'closed' | 'taken' | 'peak_cap' | 'past'
export type PlannedWeek<C> = { date: string; court: C | null; reason: WeekReason | null }

// For each date: the court it would get, or why it can't be booked.
//   closed    the club is shut that day or the booking runs past closing
//   taken     every court of that type is already booked
//   peak_cap  regulars already hold as many courts as the club allows at peak
//   past      that time has already started
export function planWeeks<C extends { id: string }>(input: {
  dates: string[]
  startTime: string // HH:MM
  durationMin: number
  courts: C[] // the courts this regular may use, in order
  busy: DatedBusy[]
  hoursFor: (date: string) => { open: string; close: string } | null
  peakCap: number | null
  startsInFuture: (date: string) => boolean
}): PlannedWeek<C>[] {
  const startMin = toMin(input.startTime)
  return input.dates.map(date => {
    if (!input.startsInFuture(date)) return { date, court: null, reason: 'past' as const }
    const h = input.hoursFor(date)
    if (!h || startMin < toMin(h.open) || startMin + input.durationMin > toMin(h.close)) return { date, court: null, reason: 'closed' as const }
    if (input.peakCap !== null && isPeakTime(date, input.startTime)) {
      const held = input.busy.filter(b => b.regular && b.date === date && overlaps(toMin(b.start_time), b.duration_minutes ?? 60, startMin, input.durationMin)).length
      if (held >= input.peakCap) return { date, court: null, reason: 'peak_cap' as const }
    }
    const court = pickCourt(input.courts, input.busy, date, startMin, input.durationMin)
    return court ? { date, court, reason: null } : { date, court: null, reason: 'taken' as const }
  })
}

// ---------------------------------------------------------- paying and release

export const payByFor = (date: string, startTime: string, tz: string): Date =>
  new Date(venueInstant(date, `${hhmm(startTime)}:00`, tz).getTime() - PAY_BY_HOURS * HOUR)

export const releaseDue = (payByIso: string | null | undefined, nowMs: number): boolean => {
  if (!payByIso) return false
  const t = Date.parse(payByIso)
  return Number.isFinite(t) && nowMs >= t
}

// A week gets one reminder, once it is within a week of play and not yet started.
export function reminderDue(startMs: number, nowMs: number, remindedAt: string | null | undefined): boolean {
  if (remindedAt) return false
  return startMs > nowMs && startMs - nowMs <= REMIND_DAYS * 24 * HOUR
}

export const hoursUntilStart = (date: string, startTime: string, tz: string, nowMs: number): number =>
  (venueInstant(date, `${hhmm(startTime)}:00`, tz).getTime() - nowMs) / HOUR

export const canSkipWeek = (date: string, startTime: string, tz: string, nowMs: number): boolean =>
  hoursUntilStart(date, startTime, tz, nowMs) > MIN_SKIP_HOURS

// ---------------------------------------------------------------- the listing

export type SeriesLite = { start_date: string; weeks: number; start_time: string; duration_minutes: number; clash_dates?: string[] | null }
export type WeekBooking = { id: string; date: string; status: string; stripe_payment_id: string | null; pay_by: string | null; regular_id?: string | null }
export type WeekKind = 'paid' | 'due' | 'skipped' | 'taken' | 'past'
export type WeekRow = { date: string; kind: WeekKind; bookingId: string | null; payBy: string | null }

// One row per week of a regular, in date order, for My bookings.
export function weekRows(series: SeriesLite, bookings: WeekBooking[], tz: string, nowMs: number): WeekRow[] {
  const clash = new Set(series.clash_dates ?? [])
  const durMs = series.duration_minutes * 60 * 1000
  return seriesDates(series.start_date, series.weeks).map(date => {
    const mine = bookings.filter(b => b.date === date)
    const live = mine.find(b => b.status !== 'cancelled')
    const ended = venueInstant(date, `${hhmm(series.start_time)}:00`, tz).getTime() + durMs <= nowMs
    if (ended) return { date, kind: 'past' as const, bookingId: live?.id ?? null, payBy: null }
    if (live) return { date, kind: live.stripe_payment_id ? 'paid' as const : 'due' as const, bookingId: live.id, payBy: live.pay_by }
    if (mine.length === 0 && clash.has(date)) return { date, kind: 'taken' as const, bookingId: null, payBy: null }
    return { date, kind: 'skipped' as const, bookingId: null, payBy: null }
  })
}

export const upcomingWeeks = (rows: WeekRow[]): WeekRow[] => rows.filter(r => r.kind !== 'past')
export const bookedWeekCount = (rows: WeekRow[]): number => rows.filter(r => r.kind === 'paid' || r.kind === 'due' || (r.kind === 'past' && r.bookingId)).length

// ------------------------------------------------------- the manager's summary

export type SummaryBooking = { regular_id?: string | null; date: string; start_time: string; duration_minutes: number | null; status: string }
export type RegularSlot = { weekday: number; time: string; courts: number }
export type RegularsSummary = { regulars: number; hoursPerWeek: number; slots: RegularSlot[]; skippedSoon: number }

// What a club's regulars hold: how many weekly regulars are live, how many court
// hours a week that is, the times they hold most courts, and how many weeks have
// been let go in the next seven days (court time back on sale).
export function summariseRegulars(bookings: SummaryBooking[], tz: string, nowMs: number, topN = 3): RegularsSummary {
  const live = bookings.filter(b => b.regular_id && b.status === 'confirmed' && venueInstant(b.date, `${hhmm(b.start_time)}:00`, tz).getTime() > nowMs)
  const byRegular = new Map<string, SummaryBooking>()
  for (const b of live) if (!byRegular.has(b.regular_id!)) byRegular.set(b.regular_id!, b)
  const slots = new Map<string, RegularSlot>()
  let minutes = 0
  for (const b of Array.from(byRegular.values())) {
    minutes += b.duration_minutes ?? 60
    const weekday = (new Date(b.date + 'T12:00:00Z').getUTCDay() + 6) % 7 // Mon = 0
    const key = `${weekday}-${hhmm(b.start_time)}`
    const cur = slots.get(key) ?? { weekday, time: hhmm(b.start_time), courts: 0 }
    cur.courts++
    slots.set(key, cur)
  }
  const weekAhead = nowMs + 7 * 24 * HOUR
  const skippedSoon = bookings.filter(b => {
    if (!b.regular_id || b.status !== 'cancelled') return false
    const t = venueInstant(b.date, `${hhmm(b.start_time)}:00`, tz).getTime()
    return t > nowMs && t <= weekAhead
  }).length
  return {
    regulars: byRegular.size,
    hoursPerWeek: Math.round((minutes / 60) * 10) / 10,
    slots: Array.from(slots.values()).sort((a, b) => b.courts - a.courts || a.weekday - b.weekday || a.time.localeCompare(b.time)).slice(0, topN),
    skippedSoon,
  }
}
