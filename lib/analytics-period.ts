// The numbers behind the Analytics tab for one club over a chosen stretch (the last 7,
// 30, 60 or 90 days), each set beside the stretch of the same length just before it.
// Pure functions of their inputs, so they are tested without a browser or database.
// Money (takings, courts by revenue) lives in the Reports tab, not here.
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'
import { computeOccupancyHeatmap, type OccupancyCell } from '@/lib/analytics'

export const PERIODS = [7, 30, 60, 90] as const
export type PeriodDays = (typeof PERIODS)[number]

export type PeriodBooking = { date: string; start_time: string; status: string; member_id: string | null }
export type PeriodMember = { id: string; full_name: string | null; created_at: string; membership_tier: string }

const counted = (b: { status: string }) => b.status === 'confirmed' || b.status === 'completed'
const dayStr = (today: Date, back: number) => format(addDays(today, -back), 'yyyy-MM-dd')

export function periodRange(todayStr: string, days: number) {
  const today = parseISO(todayStr)
  return {
    from: dayStr(today, days - 1), to: todayStr,
    prevFrom: dayStr(today, days * 2 - 1), prevTo: dayStr(today, days),
  }
}

export type Compared = { value: number; previous: number }

export type PeriodStats = {
  days: number
  bookings: Compared
  players: Compared
  utilisation: Compared // % of the hours the club could sell
  newMembers: Compared
  activeMembers: number // everyone on a paid plan right now: a snapshot, not a period
  retention: number | null // fixed window: members of 60+ days who booked in the last 30 days
  trend: { label: string; bookings: number }[]
  drifting: { id: string; name: string; tier: string; daysSince: number | null }[] // fixed window: nothing booked in 30 days
}

export function computePeriodStats(
  rows: PeriodBooking[], members: PeriodMember[], courtCount: number, hoursPerDay: number, todayStr: string, days: number,
): PeriodStats {
  const r = periodRange(todayStr, days)
  const good = rows.filter(counted)
  const inNow = good.filter(b => b.date >= r.from && b.date <= r.to)
  const inPrev = good.filter(b => b.date >= r.prevFrom && b.date <= r.prevTo)
  const players = (xs: PeriodBooking[]) => new Set(xs.map(b => b.member_id).filter(Boolean)).size
  const capacity = courtCount * hoursPerDay * days
  const util = (n: number) => (capacity > 0 ? Math.min(100, Math.round((n / capacity) * 100)) : 0)
  const today = parseISO(todayStr)
  const joined = (from: string, to: string) => members.filter(m => { const d = m.created_at.slice(0, 10); return d >= from && d <= to }).length

  // Daily bars for a week, weekly bars otherwise.
  const trend: PeriodStats['trend'] = []
  if (days <= 7) {
    for (let i = days - 1; i >= 0; i--) {
      const d = dayStr(today, i)
      trend.push({ label: format(parseISO(d), 'EEE'), bookings: good.filter(b => b.date === d).length })
    }
  } else {
    const weeks = Math.ceil(days / 7)
    for (let w = weeks - 1; w >= 0; w--) {
      const to = dayStr(today, w * 7), from = dayStr(today, w * 7 + 6)
      trend.push({ label: w === 0 ? 'This week' : format(parseISO(to), 'd MMM'), bookings: good.filter(b => b.date >= from && b.date <= to).length })
    }
  }

  const lastBooked = new Map<string, string>()
  for (const b of good) if (b.member_id && (!lastBooked.has(b.member_id) || b.date > lastBooked.get(b.member_id)!)) lastBooked.set(b.member_id, b.date)
  const ago = (id: string) => { const l = lastBooked.get(id); return l ? differenceInCalendarDays(today, parseISO(l)) : null }
  const age = (m: PeriodMember) => differenceInCalendarDays(today, parseISO(m.created_at.slice(0, 10)))
  const established = members.filter(m => age(m) >= 60)
  const retention = established.length > 0
    ? Math.round((established.filter(m => { const a = ago(m.id); return a !== null && a < 30 }).length / established.length) * 100)
    : null
  const drifting = members
    .filter(m => age(m) >= 30)
    .map(m => ({ id: m.id, name: m.full_name ?? 'Member', tier: m.membership_tier, daysSince: ago(m.id) }))
    .filter(m => m.daysSince === null || m.daysSince >= 30)
    .sort((a, b) => (b.daysSince ?? 9999) - (a.daysSince ?? 9999))
    .slice(0, 12)

  return {
    days,
    bookings: { value: inNow.length, previous: inPrev.length },
    players: { value: players(inNow), previous: players(inPrev) },
    utilisation: { value: util(inNow.length), previous: util(inPrev.length) },
    newMembers: { value: joined(r.from, r.to), previous: joined(r.prevFrom, r.prevTo) },
    activeMembers: members.filter(m => m.membership_tier !== 'casual').length,
    retention,
    trend,
    drifting,
  }
}

// "▲ 12 more than the 30 days before". Plain amounts, never a percentage, so a small
// base can't make a silly number. Nothing before it: say so rather than call it growth.
export function describeVersusBefore(c: Compared, days: number, points = false): { text: string; tone: 'up' | 'down' | 'flat' } {
  const diff = c.value - c.previous
  if (c.previous === 0 && c.value === 0) return { text: 'Nothing yet', tone: 'flat' }
  if (c.previous === 0) return { text: `▲ up from none in the ${days} days before`, tone: 'up' }
  if (diff === 0) return { text: `Same as the ${days} days before`, tone: 'flat' }
  const n = Math.abs(diff)
  const what = points ? `${n} ${n === 1 ? 'point' : 'points'}` : `${n}`
  return diff > 0 ? { text: `▲ ${what} more than the ${days} days before`, tone: 'up' } : { text: `▼ ${what} fewer than the ${days} days before`, tone: 'down' }
}

export const rangeLabel = (todayStr: string, days: number): string => {
  const r = periodRange(todayStr, days)
  const f = (d: string) => format(parseISO(d), 'd MMM')
  return `${f(r.from)} – ${f(r.to)}, compared with ${f(r.prevFrom)} – ${f(r.prevTo)}`
}

// ------------------------------------------------------------------ busy and quiet hours

export type QuietSlot = { dayOfWeek: number; hour: number; pct: number }
export const MIN_BOOKINGS_FOR_QUIET = 8

// The quietest regular slot: among the hours the club really trades (at least this share
// of courts booked, on average across the week), the weekday where that hour is emptiest.
// An hour nobody ever books is not "regular", so it is never suggested. Needs enough
// history to mean something. Earlier days and hours win a tie so the answer is steady.
export const REGULAR_HOUR_MIN_PCT = 10
export function quietestSlots(cells: OccupancyCell[], openHours: number[], bookingsInPeriod: number, n: number): QuietSlot[] {
  if (bookingsInPeriod < MIN_BOOKINGS_FOR_QUIET || openHours.length === 0 || n < 1) return []
  const open = new Set(openHours)
  const avg = new Map<number, number>()
  for (const h of Array.from(open)) {
    const row = cells.filter(c => c.hour === h)
    avg.set(h, row.length ? row.reduce((a, c) => a + c.occupancyPct, 0) / row.length : 0)
  }
  const order = (c: { dayOfWeek: number; hour: number }) => (c.dayOfWeek === 0 ? 7 : c.dayOfWeek) * 100 + c.hour
  return cells
    .filter(c => open.has(c.hour) && (avg.get(c.hour) ?? 0) >= REGULAR_HOUR_MIN_PCT)
    .sort((a, b) => a.occupancyPct - b.occupancyPct || order(a) - order(b))
    .slice(0, n)
    .map(c => ({ dayOfWeek: c.dayOfWeek, hour: c.hour, pct: c.occupancyPct }))
}
export function quietestSlot(cells: OccupancyCell[], openHours: number[], bookingsInPeriod: number): QuietSlot | null {
  return quietestSlots(cells, openHours, bookingsInPeriod, 1)[0] ?? null
}

// The next time that weekday comes round after today.
export function nextDateOnWeekday(todayStr: string, dayOfWeek: number): string {
  const today = parseISO(todayStr)
  for (let i = 1; i <= 7; i++) { const d = addDays(today, i); if (d.getDay() === dayOfWeek) return format(d, 'yyyy-MM-dd') }
  return todayStr
}

export function heatmapFor(rows: PeriodBooking[], courtCount: number, todayStr: string, days: number): OccupancyCell[] {
  return computeOccupancyHeatmap(rows, courtCount, todayStr, days)
}
