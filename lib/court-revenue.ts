// What each court could earn today, against what is actually booked on it, for the "Today's booked revenue" pie.
// Pure (everything is passed in) so it is tested without a browser or database. "Possible" is every hour the court has on
// sale today at the court's own prices (peak hours at the peak price); "booked" is what the bookings on it are worth.
import { isPeakTime } from '@/lib/pricing'
import type { CourtDay, CourtDayCourt } from '@/lib/court-day'

export type RevenueBooking = { court_id: string; date: string; status: string; price_nzd?: number | null }
export type HourBar = { hour: number; fee: number; state: 'booked' | 'blocked' | 'open' }
export type CourtRevenueRow = { id: string; name: string; booked: number; possible: number; pct: number | null; bookedHours: number; sellableHours: number; share: number | null; hours: HourBar[] }
export type CourtRevenue = { rows: CourtRevenueRow[]; booked: number; possible: number; pct: number | null; bookedHours: number; sellableHours: number; maxFee: number }

const cents = (n: number) => Math.round(n * 100) / 100
const pad = (n: number) => String(n).padStart(2, '0')

export function computeCourtRevenue(input: { courts: CourtDayCourt[]; bookings: RevenueBooking[]; day: CourtDay; date: string }): CourtRevenue {
  const { courts, bookings, day, date } = input
  const priceOf = new Map(courts.map(c => [c.id, c]))
  const rows: CourtRevenueRow[] = day.rows.map(r => {
    const c = priceOf.get(r.id)
    let possible = 0
    const hours: HourBar[] = []
    for (const cell of r.cells) {
      const peak = isPeakTime(date, `${pad(cell.hour)}:00`)
      const fee = Number(peak && c?.price_per_hour_peak ? c.price_per_hour_peak : c?.price_per_hour) || 0
      hours.push({ hour: cell.hour, fee, state: cell.state })
      if (cell.state !== 'blocked') possible += fee
    }
    const booked = bookings
      .filter(b => b.court_id === r.id && b.date === date && b.status !== 'cancelled' && b.status !== 'blocked')
      .reduce((t, b) => t + (Number(b.price_nzd) || 0), 0)
    return { id: r.id, name: r.name, booked: cents(booked), possible: cents(possible), pct: possible > 0 ? Math.round((booked / possible) * 100) : null, bookedHours: r.booked, sellableHours: r.sellable, share: null, hours }
  })
  const booked = cents(rows.reduce((t, r) => t + r.booked, 0))
  const possible = cents(rows.reduce((t, r) => t + r.possible, 0))
  for (const r of rows) r.share = booked > 0 ? Math.round((r.booked / booked) * 100) : null
  return {
    rows, booked, possible,
    pct: possible > 0 ? Math.round((booked / possible) * 100) : null,
    bookedHours: rows.reduce((t, r) => t + r.bookedHours, 0),
    sellableHours: rows.reduce((t, r) => t + r.sellableHours, 0),
    maxFee: Math.max(0, ...rows.flatMap(r => r.hours.map(h => h.fee))),
  }
}
