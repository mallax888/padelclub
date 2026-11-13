// The numbers behind the Reports tab and its exports: which days a period covers, the period
// just before it for comparison, the totals and breakdowns, and the CSV files. Pure functions
// (the clock is passed in, nothing touches the database) so they are tested on their own.
import { addDays, format, parseISO, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { timezoneForVenueSlug } from '@/lib/timezone'

export type PeriodKey = '7' | '30' | '90' | 'thisMonth' | 'lastMonth'
export const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: '7', label: '7 days' }, { key: '30', label: '30 days' }, { key: '90', label: '90 days' },
  { key: 'thisMonth', label: 'This month' }, { key: 'lastMonth', label: 'Last month' },
]
// How far back the report needs bookings, to compare even the longest period with the one before.
export const REPORT_HISTORY_DAYS = 190

export type DateRange = { from: string; to: string; days: number }
const ymd = (d: Date) => format(d, 'yyyy-MM-dd')
const spanDays = (from: string, to: string) => Math.round((parseISO(to).getTime() - parseISO(from).getTime()) / 86400000) + 1

export function periodRange(key: PeriodKey, todayStr: string): DateRange {
  const today = parseISO(todayStr)
  if (key === 'thisMonth') { const from = ymd(startOfMonth(today)); return { from, to: todayStr, days: spanDays(from, todayStr) } }
  if (key === 'lastMonth') {
    const m = subMonths(today, 1); const from = ymd(startOfMonth(m)), to = ymd(endOfMonth(m))
    return { from, to, days: spanDays(from, to) }
  }
  const days = Number(key)
  return { from: ymd(addDays(today, -(days - 1))), to: todayStr, days }
}

// The same number of days straight before: the fair thing to compare a period with.
export function previousRange(r: DateRange): DateRange {
  const to = ymd(addDays(parseISO(r.from), -1))
  return { from: ymd(addDays(parseISO(to), -(r.days - 1))), to, days: r.days }
}

export type ReportRow = {
  id?: string
  date: string
  start_time: string
  status: string
  amount: number // in the club's own currency
  payment_method: string
  stripe_payment_id: string | null
  created_at?: string | null
  court_name: string
  member_id: string | null
  member_name: string
  plan: string // the member's plan, already named
}

const EARNED = (b: ReportRow) => b.status === 'confirmed' || b.status === 'completed'
const inRange = (date: string, r: DateRange) => date >= r.from && date <= r.to
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const weekdayName = (date: string): string => WEEKDAYS[parseISO(date).getDay()]

export type Summary = {
  revenue: number
  bookings: number
  average: number
  cancelled: number // paid by card and later cancelled: an estimate of what went back
  byDay: { date: string; revenue: number; bookings: number }[]
  byCourt: { name: string; revenue: number; bookings: number }[]
  byMethod: { method: string; revenue: number; bookings: number }[]
  topMembers: { name: string; plan: string; bookings: number; spent: number }[]
  bestWeekday: { name: string; revenue: number } | null
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function summarise(rows: ReportRow[], range: DateRange): Summary {
  const earned = rows.filter(b => EARNED(b) && inRange(b.date, range))
  const revenue = round2(earned.reduce((s, b) => s + (b.amount || 0), 0))
  const cancelled = round2(rows.filter(b => b.status === 'cancelled' && b.stripe_payment_id && inRange(b.date, range)).reduce((s, b) => s + (b.amount || 0), 0))

  const days = new Map<string, { revenue: number; bookings: number }>()
  for (let i = 0; i < range.days; i++) days.set(ymd(addDays(parseISO(range.from), i)), { revenue: 0, bookings: 0 })
  const group = <K extends string>(key: (b: ReportRow) => K) => {
    const m = new Map<K, { revenue: number; bookings: number }>()
    for (const b of earned) { const g = m.get(key(b)) ?? { revenue: 0, bookings: 0 }; g.revenue += b.amount || 0; g.bookings += 1; m.set(key(b), g) }
    return m
  }
  for (const b of earned) { const d = days.get(b.date); if (d) { d.revenue += b.amount || 0; d.bookings += 1 } }
  const sorted = <T extends { revenue: number }>(a: T[]) => a.sort((x, y) => y.revenue - x.revenue)

  const members = new Map<string, { name: string; plan: string; bookings: number; spent: number }>()
  for (const b of earned) {
    const k = b.member_id ?? `name:${b.member_name}`
    const m = members.get(k) ?? { name: b.member_name, plan: b.plan, bookings: 0, spent: 0 }
    m.bookings += 1; m.spent += b.amount || 0; members.set(k, m)
  }
  const byWeekday = new Map<string, number>()
  for (const b of earned) byWeekday.set(weekdayName(b.date), (byWeekday.get(weekdayName(b.date)) ?? 0) + (b.amount || 0))
  const best = Array.from(byWeekday.entries()).sort((a, b) => b[1] - a[1] || WEEKDAYS.indexOf(a[0]) - WEEKDAYS.indexOf(b[0]))[0]

  return {
    revenue, bookings: earned.length, average: earned.length ? round2(revenue / earned.length) : 0, cancelled,
    byDay: Array.from(days.entries()).map(([date, v]) => ({ date, revenue: round2(v.revenue), bookings: v.bookings })),
    byCourt: sorted(Array.from(group(b => b.court_name).entries()).map(([name, v]) => ({ name, revenue: round2(v.revenue), bookings: v.bookings }))),
    byMethod: sorted(Array.from(group(b => b.payment_method).entries()).map(([method, v]) => ({ method, revenue: round2(v.revenue), bookings: v.bookings }))),
    topMembers: Array.from(members.values()).filter(m => m.name !== '—').map(m => ({ ...m, spent: round2(m.spent) })).sort((a, b) => b.spent - a.spent || b.bookings - a.bookings || a.name.localeCompare(b.name)).slice(0, 5),
    bestWeekday: best && best[1] > 0 ? { name: best[0], revenue: round2(best[1]) } : null,
  }
}

export type Change = { pct: number | null; dir: 'up' | 'down' | 'flat' | 'new' | 'none' }
// How much a figure moved since the period before. No earlier figure to compare with is "new" (or "none" when both are zero).
export function change(current: number, previous: number): Change {
  if (previous === 0) return current === 0 ? { pct: null, dir: 'none' } : { pct: null, dir: 'new' }
  const pct = Math.round(((current - previous) / previous) * 100)
  return { pct, dir: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat' }
}
export function describeChange(c: Change): string {
  if (c.dir === 'none') return 'Nothing in either period'
  if (c.dir === 'new') return 'New: nothing in the period before'
  if (c.dir === 'flat') return 'No change'
  return `${c.dir === 'up' ? '▲' : '▼'} ${Math.abs(c.pct as number)}%`
}

// ---------------------------------------------------------------- CSV

// A spreadsheet runs a cell that starts with = + - or @ as a formula, and names come from sign-ups, so
// text columns are defused by putting a quote in front.
export const csvText = (v: unknown): string => {
  let s = String(v ?? '')
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}
const csvNum = (n: number) => n.toFixed(2)
const BOM = '﻿' // so Excel reads names with accents properly

export const PAYMENT_LABELS: Record<string, string> = { card: 'Card', credits: 'Session credits', membership_allowance: 'Membership allowance', staff_block: 'Staff block' }
export const paymentLabel = (m: string): string => PAYMENT_LABELS[m] ?? m

const bookedOn = (iso: string | null | undefined, venueSlug: string): string => {
  if (!iso) return ''
  const t = new Date(iso)
  return Number.isNaN(t.getTime()) ? '' : new Intl.DateTimeFormat('en-CA', { timeZone: timezoneForVenueSlug(venueSlug) }).format(t)
}

export function detailedCsv(rows: ReportRow[], range: DateRange, opts: { clubName: string; venueSlug: string; currency: string }): string {
  const header = ['Date', 'Day', 'Time', 'Club', 'Court', 'Member', 'Plan', 'Amount', 'Currency', 'Paid with', 'Status', 'Booked on']
  const lines = rows.filter(b => inRange(b.date, range) && (EARNED(b))).sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time)).map(b => [
    b.date, weekdayName(b.date).slice(0, 3), b.start_time?.slice(0, 5) ?? '', csvText(opts.clubName), csvText(b.court_name), csvText(b.member_name), csvText(b.plan),
    csvNum(b.amount || 0), opts.currency.toUpperCase(), csvText(paymentLabel(b.payment_method)), b.status, bookedOn(b.created_at, opts.venueSlug),
  ].join(','))
  return BOM + [header.join(','), ...lines].join('\n')
}

export function dailyCsv(summary: Summary, opts: { currency: string }): string {
  const header = ['Date', 'Day', 'Bookings', 'Revenue', 'Currency']
  return BOM + [header.join(','), ...summary.byDay.map(d => [d.date, weekdayName(d.date).slice(0, 3), d.bookings, csvNum(d.revenue), opts.currency.toUpperCase()].join(','))].join('\n')
}
