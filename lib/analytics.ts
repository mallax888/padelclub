import { addDays, format, parseISO, differenceInCalendarDays } from 'date-fns'
import { currencyForRegion, sumByCurrency, type CurrencyCode } from '@/lib/currency'
import { getVenue } from '@/lib/venues'

const currencyForVenueSlug = (venueSlug: string | null | undefined): CurrencyCode =>
  currencyForRegion(venueSlug ? getVenue(venueSlug).region : undefined)

// Matches the booking flow's own operating window (generateTimeSlots(7, 22, 60)
// in components/admin/AdminDashboard.tsx) -- 15 one-hour slots/day. Utilization
// is an estimate against that assumed window, not a stored "open hours" value.
const SLOTS_PER_DAY = 15

export type AnalyticsBooking = {
  user_id: string | null
  court_id: string
  date: string
  price_nzd: number
  status: string
  venue_slug?: string | null
}

export type AnalyticsMember = {
  id: string
  full_name: string | null
  created_at: string
  membership_tier: string
}

export type CurrencyTotal = { currency: CurrencyCode; amount: number }

export type WeeklyTrendPoint = { label: string; bookings: number; revenueByCurrency: CurrencyTotal[] }

export type AtRiskMember = {
  id: string
  name: string
  tier: string
  daysSinceLastBooking: number | null // null = no booking found in the fetched window (90+ days, or never)
}

export type ClubAnalytics = {
  utilization7d: number
  uniquePlayers30d: number
  revenueByCurrency30d: CurrencyTotal[]
  bookings30d: number
  activeMembers: number
  weeklyTrend: WeeklyTrendPoint[]
  atRisk: AtRiskMember[]
  newMembers30d: number
  retentionRate: number | null // null = not enough of a member base (>=60 days old) to make the rate meaningful yet
}

export type OccupancyCell = { dayOfWeek: number; hour: number; occupancyPct: number }

// { label, amount } per payment method, split by currency (a venue mixing
// currencies would otherwise blend NZD/AUD/ZAR into one meaningless total
// the same way a plain revenue sum would).
export type PaymentMethodTotal = { method: string; currency: CurrencyCode; amount: number; bookings: number }

export type FinancialSummary = {
  grossByCurrency: CurrencyTotal[]
  byPaymentMethod: PaymentMethodTotal[]
  // Confirmed-at-payment-time revenue that was later cancelled -- an
  // estimate of money given back (full Stripe refund or partial credit),
  // not a precise ledger, since card refunds aren't recorded in a local
  // table anywhere (only the Stripe API call itself).
  cancelledRevenueByCurrency: CurrencyTotal[]
  creditsIssued: number
  creditsUsed: number
  creditsRefunded: number
}

export type CourtPerformanceBooking = {
  court_id: string
  court_name: string
  date: string
  price_nzd: number
  status: string
  venue_slug?: string | null
}

export type CourtPerformance = {
  courtId: string
  courtName: string
  bookings: number
  revenue: number
  currency: CurrencyCode
}

export type CourtPerformancePeriod = 'week' | 'month' | 'year'

// Client-side pure function (no server-only deps) so the Admin UI can toggle
// week/month/year instantly against one already-fetched, 370-day-bounded
// booking set instead of re-querying per period.
export function computeCourtPerformance(
  bookings: CourtPerformanceBooking[],
  todayStr: string,
  period: CourtPerformancePeriod
): CourtPerformance[] {
  const today = parseISO(todayStr)
  const daysBack = period === 'week' ? 6 : period === 'month' ? 29 : 364
  const since = format(addDays(today, -daysBack), 'yyyy-MM-dd')
  const counted = bookings.filter(b => (b.status === 'confirmed' || b.status === 'completed') && b.date >= since)

  const byCourt = new Map<string, CourtPerformance>()
  for (const b of counted) {
    const existing = byCourt.get(b.court_id)
    if (existing) {
      existing.bookings += 1
      existing.revenue += b.price_nzd || 0
    } else {
      byCourt.set(b.court_id, {
        courtId: b.court_id,
        courtName: b.court_name,
        bookings: 1,
        revenue: b.price_nzd || 0,
        currency: currencyForVenueSlug(b.venue_slug),
      })
    }
  }
  return Array.from(byCourt.values()).sort((a, b) => b.revenue - a.revenue)
}

export function computeClubAnalytics(
  bookings: AnalyticsBooking[],
  members: AnalyticsMember[],
  courtCount: number,
  todayStr: string
): ClubAnalytics {
  const today = parseISO(todayStr)
  const counted = bookings.filter(b => b.status === 'confirmed' || b.status === 'completed')

  const daysAgo = (n: number) => format(addDays(today, -n), 'yyyy-MM-dd')
  const inRange = (dateStr: string, fromDaysAgo: number, toDaysAgo: number) =>
    dateStr >= daysAgo(fromDaysAgo) && dateStr <= daysAgo(toDaysAgo)

  const last7 = counted.filter(b => inRange(b.date, 6, 0))
  const last30 = counted.filter(b => inRange(b.date, 29, 0))

  const totalSlots7d = courtCount * SLOTS_PER_DAY * 7
  const utilization7d = totalSlots7d > 0 ? Math.min(100, Math.round((last7.length / totalSlots7d) * 100)) : 0
  const uniquePlayers30d = new Set(last30.map(b => b.user_id).filter(Boolean)).size
  const revenueByCurrency30d = sumByCurrency(last30, b => currencyForVenueSlug(b.venue_slug), b => b.price_nzd || 0)
  const activeMembers = members.filter(m => m.membership_tier !== 'casual').length

  const weeklyTrend: WeeklyTrendPoint[] = []
  for (let w = 7; w >= 0; w--) {
    const from = w * 7 + 6
    const to = w * 7
    const bucket = counted.filter(b => inRange(b.date, from, to))
    weeklyTrend.push({
      label: w === 0 ? 'This week' : format(addDays(today, -to), 'MMM d'),
      bookings: bucket.length,
      revenueByCurrency: sumByCurrency(bucket, b => currencyForVenueSlug(b.venue_slug), b => b.price_nzd || 0),
    })
  }

  const lastBookingByUser = new Map<string, string>()
  for (const b of counted) {
    if (!b.user_id) continue
    const existing = lastBookingByUser.get(b.user_id)
    if (!existing || b.date > existing) lastBookingByUser.set(b.user_id, b.date)
  }

  const atRisk: AtRiskMember[] = members
    .filter(m => differenceInCalendarDays(today, parseISO(m.created_at.slice(0, 10))) >= 30)
    .map(m => {
      const last = lastBookingByUser.get(m.id)
      const daysSinceLastBooking = last ? differenceInCalendarDays(today, parseISO(last)) : null
      return { id: m.id, name: m.full_name ?? 'Member', tier: m.membership_tier, daysSinceLastBooking }
    })
    .filter(m => m.daysSinceLastBooking === null || m.daysSinceLastBooking >= 30)
    .sort((a, b) => (b.daysSinceLastBooking ?? 9999) - (a.daysSinceLastBooking ?? 9999))
    .slice(0, 12)

  const newMembers30d = members.filter(m => differenceInCalendarDays(today, parseISO(m.created_at.slice(0, 10))) < 30).length

  // Of members with enough tenure to have an established pattern (joined
  // 60+ days ago -- a member from last week hasn't had a fair chance to
  // "retain" yet), what fraction booked at least once in the last 30 days.
  const establishedMembers = members.filter(m => differenceInCalendarDays(today, parseISO(m.created_at.slice(0, 10))) >= 60)
  const retentionRate = establishedMembers.length > 0
    ? Math.round((establishedMembers.filter(m => {
        const last = lastBookingByUser.get(m.id)
        return last !== undefined && differenceInCalendarDays(today, parseISO(last)) < 30
      }).length / establishedMembers.length) * 100)
    : null

  return { utilization7d, uniquePlayers30d, revenueByCurrency30d, bookings30d: last30.length, activeMembers, weeklyTrend, atRisk, newMembers30d, retentionRate }
}

export type OccupancyBooking = { date: string; start_time: string; status: string }

// Day-of-week x hour-of-day grid of booking density over the trailing
// `days` window, e.g. "Saturday mornings are dead, Tuesday evenings are
// packed" -- a different question than utilization7d's single club-wide
// percentage, useful for pricing/staffing decisions rather than a
// one-number health check.
export function computeOccupancyHeatmap(
  bookings: OccupancyBooking[],
  courtCount: number,
  todayStr: string,
  days = 28,
): OccupancyCell[] {
  const today = new Date(todayStr + 'T00:00:00')
  const since = format(addDays(today, -(days - 1)), 'yyyy-MM-dd')
  const counted = bookings.filter(b => (b.status === 'confirmed' || b.status === 'completed') && b.date >= since && b.date <= todayStr)

  // How many times each weekday actually occurred in the window -- the
  // denominator for that weekday's occupancy %, since a 28-day window has
  // exactly 4 of each weekday only when it aligns perfectly.
  const dayOccurrences = new Array(7).fill(0)
  for (let i = 0; i < days; i++) {
    dayOccurrences[addDays(today, -i).getDay()]++
  }

  const counts = new Map<string, number>()
  for (const b of counted) {
    const dow = new Date(b.date + 'T00:00:00').getDay()
    const hour = parseInt(b.start_time.slice(0, 2), 10)
    const key = `${dow}-${hour}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const cells: OccupancyCell[] = []
  for (let dow = 0; dow < 7; dow++) {
    for (let hour = 7; hour < 7 + SLOTS_PER_DAY; hour++) {
      const denom = dayOccurrences[dow] * courtCount
      const booked = counts.get(`${dow}-${hour}`) ?? 0
      cells.push({ dayOfWeek: dow, hour, occupancyPct: denom > 0 ? Math.min(100, Math.round((booked / denom) * 100)) : 0 })
    }
  }
  return cells
}

export type FinancialBooking = {
  date: string
  status: string
  price_nzd: number
  payment_method: string
  stripe_payment_id: string | null
  venue_slug?: string | null
}

export type FinancialCreditTx = { created_at: string; amount: number; type: string }

export function computeFinancialSummary(
  bookings: FinancialBooking[],
  creditTx: FinancialCreditTx[],
  todayStr: string,
  periodDays: number,
): FinancialSummary {
  const today = new Date(todayStr + 'T00:00:00')
  const since = format(addDays(today, -(periodDays - 1)), 'yyyy-MM-dd')
  const inPeriod = (dateStr: string) => dateStr >= since && dateStr <= todayStr

  const earned = bookings.filter(b => (b.status === 'confirmed' || b.status === 'completed') && inPeriod(b.date))
  const grossByCurrency = sumByCurrency(earned, b => currencyForVenueSlug(b.venue_slug), b => b.price_nzd || 0)

  const methodBuckets = new Map<string, PaymentMethodTotal>()
  for (const b of earned) {
    const currency = currencyForVenueSlug(b.venue_slug)
    const key = `${b.payment_method}-${currency}`
    const existing = methodBuckets.get(key)
    if (existing) {
      existing.amount += b.price_nzd || 0
      existing.bookings += 1
    } else {
      methodBuckets.set(key, { method: b.payment_method, currency, amount: b.price_nzd || 0, bookings: 1 })
    }
  }

  // A booking that was paid (has a Stripe payment) and later cancelled --
  // an estimate of revenue given back (full refund or partial credit), not
  // a precise ledger, since card refunds themselves aren't recorded in any
  // local table (only the Stripe API call that issues one).
  const cancelledPaid = bookings.filter(b => b.status === 'cancelled' && b.stripe_payment_id && inPeriod(b.date))
  const cancelledRevenueByCurrency = sumByCurrency(cancelledPaid, b => currencyForVenueSlug(b.venue_slug), b => b.price_nzd || 0)

  const txInPeriod = creditTx.filter(t => inPeriod(t.created_at.slice(0, 10)))
  const creditsIssued = txInPeriod.filter(t => t.type === 'purchase').reduce((s, t) => s + Math.abs(t.amount), 0)
  const creditsUsed = txInPeriod.filter(t => t.type === 'used').reduce((s, t) => s + Math.abs(t.amount), 0)
  const creditsRefunded = txInPeriod.filter(t => t.type === 'refund').reduce((s, t) => s + Math.abs(t.amount), 0)

  return {
    grossByCurrency,
    byPaymentMethod: Array.from(methodBuckets.values()).sort((a, b) => b.amount - a.amount),
    cancelledRevenueByCurrency,
    creditsIssued,
    creditsUsed,
    creditsRefunded,
  }
}
