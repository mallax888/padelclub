// The numbers behind the admin "Money & demand" panel: what a club is still
// owed in unpaid shares, and how much court time over the coming week is still
// unsold. Pure functions of their inputs (no fetching, no "now" read inside),
// so the cases that matter can be tested without a browser or a database.
import { isPeakTime } from '@/lib/pricing'
import { timezoneForVenueSlug, venueInstant } from '@/lib/timezone'

// The same selling window the booking flow and the Board use
// (generateTimeSlots(7, 22, 60) -- 15 one-hour slots a day). Venues don't store
// opening hours, so "empty" is measured against this assumed window.
export const OPEN_HOUR = 7
export const CLOSE_HOUR = 22

const DAY_MS = 24 * 60 * 60 * 1000
const pad = (n: number) => String(n).padStart(2, '0')
const round2 = (n: number) => Math.round(n * 100) / 100

// ---------------------------------------------------------------- unpaid shares

export type UnpaidShareRow = {
  id: string
  amount: number
  createdAt: string
  date: string
  startTime: string
  courtName: string
  venueSlug: string
  bookingStatus: string
  playerName: string
  organiserName: string | null
}

export type AgeBand = 'fresh' | 'mid' | 'old'

// Matches the rhythm of the automatic reminders: the first nudge goes out
// straight away, the later ones from about a day and a week on.
export const bandFor = (ageDays: number): AgeBand => (ageDays < 2 ? 'fresh' : ageDays <= 7 ? 'mid' : 'old')

export type UnpaidShareLine = UnpaidShareRow & { ageDays: number; band: AgeBand }

export type UnpaidSummary = {
  total: number
  count: number
  bands: Record<AgeBand, { count: number; amount: number }>
  rows: UnpaidShareLine[] // oldest first
}

export function summariseUnpaidShares(rows: UnpaidShareRow[], venueSlug: string, nowMs: number): UnpaidSummary {
  const bands: UnpaidSummary['bands'] = { fresh: { count: 0, amount: 0 }, mid: { count: 0, amount: 0 }, old: { count: 0, amount: 0 } }
  const lines: UnpaidShareLine[] = []
  let total = 0
  for (const r of rows) {
    // A share on a cancelled booking is no longer owed: cancelling withdraws it.
    if (r.venueSlug !== venueSlug || r.bookingStatus === 'cancelled') continue
    const created = Date.parse(r.createdAt)
    const ageDays = Number.isFinite(created) ? Math.max(0, Math.floor((nowMs - created) / DAY_MS)) : 0
    const band = bandFor(ageDays)
    const amount = Number(r.amount) || 0
    bands[band].count += 1
    bands[band].amount += amount
    total += amount
    lines.push({ ...r, ageDays, band })
  }
  for (const b of Object.values(bands)) b.amount = round2(b.amount)
  lines.sort((a, b) => b.ageDays - a.ageDays || Date.parse(a.createdAt) - Date.parse(b.createdAt))
  return { total: round2(total), count: lines.length, bands, rows: lines }
}

// ------------------------------------------------------------------ empty time

export type CourtLite = { id: string; price_per_hour: number; price_per_hour_peak: number | null; is_active?: boolean | null }
export type BookingLite = { court_id: string; date: string; start_time: string; end_time: string; status: string }

export type DayDemand = { date: string; label: string; sellable: number; booked: number; empty: number; fillPct: number | null }
export type DemandGap = { date: string; from: string; to: string; courts: number; kind: 'peak' | 'quiet' | 'mixed'; emptyHours: number }
export type Bucket = { sellable: number; empty: number; fillPct: number | null }

export type EmptyTime = {
  courtCount: number
  days: DayDemand[]
  emptyHours: number
  potential: number // court fees if every empty hour sold at the court's listed price
  peak: Bucket
  quiet: Bucket
  gaps: DemandGap[]
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const addDaysStr = (d: string, n: number) => {
  const t = new Date(d + 'T00:00:00Z')
  t.setUTCDate(t.getUTCDate() + n)
  return t.toISOString().slice(0, 10)
}
const weekdayOf = (d: string) => WEEKDAYS[new Date(d + 'T12:00:00Z').getUTCDay()]
const minutesOf = (t: string) => parseInt(t.slice(0, 2), 10) * 60 + parseInt(t.slice(3, 5), 10)
const todayIn = (tz: string, nowMs: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(nowMs))
const pct = (booked: number, sellable: number) => (sellable > 0 ? Math.round((booked / sellable) * 100) : null)

export function computeEmptyCourtTime(courts: CourtLite[], bookings: BookingLite[], venueSlug: string, nowMs: number, spanDays = 7): EmptyTime {
  const active = courts.filter(c => c.is_active !== false)
  const tz = timezoneForVenueSlug(venueSlug)
  const today = todayIn(tz, nowMs)

  const peak = { sellable: 0, empty: 0 }
  const quiet = { sellable: 0, empty: 0 }
  const days: DayDemand[] = []
  const emptyByHour = new Map<string, number[]>() // date -> courts empty at each hour (-1 = hour not on sale)
  let potential = 0

  for (let i = 0; i < spanDays; i++) {
    const date = addDaysStr(today, i)
    const day: DayDemand = { date, label: weekdayOf(date), sellable: 0, booked: 0, empty: 0, fillPct: null }
    const hourly: number[] = []
    for (let h = OPEN_HOUR; h < CLOSE_HOUR; h++) {
      // An hour that has started can't be sold any more.
      if (venueInstant(date, `${pad(h)}:00:00`, tz).getTime() < nowMs) { hourly.push(-1); continue }
      const peakHour = isPeakTime(date, `${pad(h)}:00`)
      let emptyCourts = 0
      let onSale = 0
      for (const court of active) {
        const hits = bookings.filter(b =>
          b.court_id === court.id && b.date === date && b.status !== 'cancelled' &&
          minutesOf(b.start_time) < (h + 1) * 60 && minutesOf(b.end_time) > h * 60)
        // A court the club has blocked isn't for sale, so it isn't "empty" either.
        if (hits.some(b => b.status === 'blocked')) continue
        onSale++
        const bucket = peakHour ? peak : quiet
        bucket.sellable++
        day.sellable++
        if (hits.length > 0) { day.booked++; continue }
        bucket.empty++
        day.empty++
        emptyCourts++
        potential += peakHour && court.price_per_hour_peak ? court.price_per_hour_peak : court.price_per_hour
      }
      hourly.push(onSale > 0 ? emptyCourts : -1)
    }
    day.fillPct = pct(day.booked, day.sellable)
    days.push(day)
    emptyByHour.set(date, hourly)
  }

  // Biggest gaps: runs of two or more consecutive hours with plenty of courts
  // empty at once -- the slots worth a promotion.
  const threshold = active.length >= 2 ? Math.max(2, Math.ceil(active.length / 2)) : 1
  const gaps: DemandGap[] = []
  for (const date of Array.from(emptyByHour.keys())) {
    const hourly = emptyByHour.get(date)!
    let start = -1
    const close = (endIdx: number) => {
      if (start < 0 || endIdx - start < 2) { start = -1; return }
      const run = hourly.slice(start, endIdx)
      const hours = run.map((_, k) => OPEN_HOUR + start + k)
      const peaks = hours.filter(h => isPeakTime(date, `${pad(h)}:00`)).length
      gaps.push({
        date,
        from: `${pad(hours[0])}:00`,
        to: `${pad(hours[hours.length - 1] + 1)}:00`,
        courts: Math.min(...run),
        kind: peaks === hours.length ? 'peak' : peaks === 0 ? 'quiet' : 'mixed',
        emptyHours: run.reduce((a, b) => a + b, 0),
      })
      start = -1
    }
    hourly.forEach((n, idx) => {
      if (n >= threshold) { if (start < 0) start = idx } else close(idx)
    })
    close(hourly.length)
  }
  gaps.sort((a, b) => b.emptyHours - a.emptyHours || (a.date < b.date ? -1 : 1))

  const emptyHours = peak.empty + quiet.empty
  return {
    courtCount: active.length,
    days,
    emptyHours,
    potential: Math.round(potential),
    peak: { sellable: peak.sellable, empty: peak.empty, fillPct: pct(peak.sellable - peak.empty, peak.sellable) },
    quiet: { sellable: quiet.sellable, empty: quiet.empty, fillPct: pct(quiet.sellable - quiet.empty, quiet.sellable) },
    gaps: gaps.slice(0, 3),
  }
}
