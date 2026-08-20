import { addDays, format, parseISO, differenceInCalendarDays } from 'date-fns'

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
}

export type AnalyticsMember = {
  id: string
  full_name: string | null
  created_at: string
  membership_tier: string
}

export type WeeklyTrendPoint = { label: string; bookings: number; revenue: number }

export type AtRiskMember = {
  id: string
  name: string
  tier: string
  daysSinceLastBooking: number | null // null = no booking found in the fetched window (90+ days, or never)
}

export type ClubAnalytics = {
  utilization7d: number
  uniquePlayers30d: number
  revenue30d: number
  bookings30d: number
  activeMembers: number
  weeklyTrend: WeeklyTrendPoint[]
  atRisk: AtRiskMember[]
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
  const revenue30d = last30.reduce((s, b) => s + (b.price_nzd || 0), 0)
  const activeMembers = members.filter(m => m.membership_tier !== 'casual').length

  const weeklyTrend: WeeklyTrendPoint[] = []
  for (let w = 7; w >= 0; w--) {
    const from = w * 7 + 6
    const to = w * 7
    const bucket = counted.filter(b => inRange(b.date, from, to))
    weeklyTrend.push({
      label: w === 0 ? 'This week' : format(addDays(today, -to), 'MMM d'),
      bookings: bucket.length,
      revenue: bucket.reduce((s, b) => s + (b.price_nzd || 0), 0),
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

  return { utilization7d, uniquePlayers30d, revenue30d, bookings30d: last30.length, activeMembers, weeklyTrend, atRisk }
}
