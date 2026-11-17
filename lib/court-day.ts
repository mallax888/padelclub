// Court by court, hour by hour, for one day at a club: how much of each court is sold, what can still be sold,
// and what that is worth. Pure functions of their inputs (the clock is passed in) so the cases that matter are
// tested without a browser or a database. The hours counted are the same ones "Fill empty courts" counts: whole
// hours inside the club's opening hours, where an hour that has already started can no longer be sold.
import { isPeakTime } from '@/lib/pricing'
import { dayHours, toMinutes, type WeekHours } from '@/lib/venue-hours'
import { OPEN_HOUR } from '@/lib/money-demand'

const pad = (n: number) => String(n).padStart(2, '0')
const minutesOf = (t: string) => parseInt(t.slice(0, 2), 10) * 60 + parseInt(t.slice(3, 5), 10)

export type CourtDayCourt = { id: string; name: string; is_active?: boolean | null; price_per_hour?: number | null; price_per_hour_peak?: number | null }
export type CourtDayBooking = { court_id: string; date: string; start_time: string; end_time: string; status: string }
export type CourtDayCell = { hour: number; state: 'booked' | 'blocked' | 'open'; past: boolean }
export type OpenRange = { from: string; to: string }
export type CourtDayRow = {
  id: string
  name: string
  cells: CourtDayCell[]
  booked: number // hours sold today (past and to come)
  sellable: number // hours that are on sale today (a blocked hour is not)
  pct: number | null // booked / sellable
  openNow: number // hours that can still be sold
  openRanges: OpenRange[]
  openValue: number // what those hours would earn at the court's own prices
}
export type CourtDay = {
  firstHour: number
  endHour: number
  rows: CourtDayRow[] // in court order (Court 1, 2, 3...), so each court stays where the manager expects it
  booked: number
  sellable: number
  pct: number | null
  openNow: number
  openValue: number
  finished: boolean // every hour of the day has started or passed
}

export function computeCourtDay(
  input: { courts: CourtDayCourt[]; bookings: CourtDayBooking[]; date: string; nowMinutes: number; week?: WeekHours | null },
): CourtDay {
  const { courts, bookings, date, nowMinutes, week } = input
  const dh = dayHours(week, date)
  const firstHour = dh ? Math.ceil(toMinutes(dh.open) / 60) : OPEN_HOUR
  const endHour = dh ? Math.floor(toMinutes(dh.close) / 60) : OPEN_HOUR

  const rows: CourtDayRow[] = courts.filter(c => c.is_active !== false).map(c => {
    const cells: CourtDayCell[] = []
    let booked = 0, sellable = 0, openNow = 0, openValue = 0
    const openHours: number[] = []
    for (let h = firstHour; h < endHour; h++) {
      const hits = bookings.filter(b => b.court_id === c.id && b.date === date && b.status !== 'cancelled'
        && minutesOf(b.start_time) < (h + 1) * 60 && minutesOf(b.end_time) > h * 60)
      const past = h * 60 < nowMinutes
      if (hits.some(b => b.status === 'blocked')) { cells.push({ hour: h, state: 'blocked', past }); continue }
      sellable++
      if (hits.length > 0) { booked++; cells.push({ hour: h, state: 'booked', past }); continue }
      cells.push({ hour: h, state: 'open', past })
      if (!past) {
        openNow++; openHours.push(h)
        const peak = isPeakTime(date, `${pad(h)}:00`)
        openValue += Number(peak && c.price_per_hour_peak ? c.price_per_hour_peak : c.price_per_hour) || 0
      }
    }
    const openRanges: OpenRange[] = []
    for (const h of openHours) {
      const last = openRanges[openRanges.length - 1]
      if (last && last.to === `${pad(h)}:00`) last.to = `${pad(h + 1)}:00`
      else openRanges.push({ from: `${pad(h)}:00`, to: `${pad(h + 1)}:00` })
    }
    return { id: c.id, name: c.name, cells, booked, sellable, pct: sellable > 0 ? Math.round((booked / sellable) * 100) : null, openNow, openRanges, openValue: Math.round(openValue * 100) / 100 }
  }).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))

  const sum = (f: (r: CourtDayRow) => number) => rows.reduce((t, r) => t + f(r), 0)
  const booked = sum(r => r.booked), sellable = sum(r => r.sellable)
  return {
    firstHour, endHour, rows, booked, sellable,
    pct: sellable > 0 ? Math.round((booked / sellable) * 100) : null,
    openNow: sum(r => r.openNow),
    openValue: Math.round(sum(r => r.openValue) * 100) / 100,
    finished: endHour * 60 <= nowMinutes || endHour <= firstHour,
  }
}

// "1 open from 18:00" or "2 open · 15:00–17:00" (two ranges at most, then an ellipsis).
export function describeOpen(row: CourtDayRow): string | null {
  if (row.openNow === 0) return null
  if (row.openNow === 1) return `1 open from ${row.openRanges[0].from}`
  const shown = row.openRanges.slice(0, 2).map(r => `${r.from}–${r.to}`).join(', ')
  return `${row.openNow} open · ${shown}${row.openRanges.length > 2 ? '…' : ''}`
}
