'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { cn, formatDate, generateTimeSlots, getNextNDates, localDateStr } from '@/lib/utils'
import type { Court, Profile } from '@/types/database'
import { VENUES, COUNTRIES, getVenue } from '@/lib/venues'
import { currencyForRegion, formatPrice, sumByCurrency, formatMultiCurrency } from '@/lib/currency'

const currencyForVenueSlug = (venueSlug: string | null | undefined) =>
  currencyForRegion(venueSlug ? getVenue(venueSlug).region : undefined)
import XeroSettingsPanel from '@/components/admin/XeroSettingsPanel'
import ClubAnalytics from '@/components/admin/ClubAnalytics'
import FinancialReports from '@/components/admin/FinancialReports'
import AdminSidebar from '@/components/admin/AdminSidebar'
import BoardRightRail from '@/components/admin/BoardRightRail'
import BoardFooterStrip from '@/components/admin/BoardFooterStrip'
import type { ClubAnalytics as ClubAnalyticsData, CourtPerformanceBooking, FinancialCreditTx } from '@/lib/analytics'

const TIME_SLOTS = generateTimeSlots(7, 22, 60)

// Trailing-7-day mini trend line for a stat card -- no charting library
// needed for a single series this small.
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const w = 64
  const h = 24
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const points = data.map((v, i) => {
    const x = data.length > 1 ? (i / (data.length - 1)) * w : w / 2
    const y = h - ((v - min) / range) * h
    return [x, y] as const
  })
  const last = points[points.length - 1]
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
      <polyline points={points.map(p => p.join(',')).join(' ')} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinejoin="round" strokeLinecap="round" opacity="0.85" />
      {last && <circle cx={last[0]} cy={last[1]} r="2" fill={color} />}
    </svg>
  )
}

type AdminBooking = {
  id: string
  date: string
  start_time: string
  end_time: string
  status: string
  price_nzd: number
  payment_method: string
  stripe_payment_id?: string | null
  notes: string | null
  profiles: { full_name: string | null; membership_tier: string } | null
  courts: { name: string; type: string; venue_slug?: string | null } | null
}

export default function AdminDashboard({
  bookings,
  members,
  courts,
  managedVenueSlug,
  managedCountry,
  analytics,
  courtPerfBookings,
  creditTransactions,
  publicBookingIds,
  staffName,
}: {
  bookings: AdminBooking[]
  members: Profile[]
  courts: Court[]
  managedVenueSlug?: string | null
  managedCountry?: string | null
  analytics: ClubAnalyticsData
  courtPerfBookings: CourtPerformanceBooking[]
  creditTransactions: FinancialCreditTx[]
  publicBookingIds: string[]
  staffName: string | null
}) {
  const router = useRouter()
  const [tab, setTab] = useState<'board' | 'analytics' | 'reports' | 'bookings' | 'members' | 'courts' | 'xero'>('board')
  const [selectedVenueSlug, setSelectedVenueSlug] = useState<string>('')
  const [selectedCountry, setSelectedCountry] = useState<string>('')
  const [selectedCity, setSelectedCity] = useState<string>('')
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week')
  const [boardDate, setBoardDate] = useState(localDateStr())
  const [showBlock, setShowBlock] = useState(false)
  const [showPastBookings, setShowPastBookings] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')
  const [memberTierFilter, setMemberTierFilter] = useState<'all' | string>('all')
  const [blockForm, setBlockForm] = useState({
    courtId: courts[0]?.id ?? '',
    date: getNextNDates(1)[0],
    time: '09:00',
    notes: '',
  })
  const [editingCourt, setEditingCourt] = useState<Court | 'new' | null>(null)
  const [courtForm, setCourtForm] = useState({
    name: '',
    type: '',
    price_per_hour: '',
    price_per_hour_peak: '',
    is_active: true,
    is_indoor: true,
    description: '',
  })
  const [savingCourt, setSavingCourt] = useState(false)

  const today = localDateStr()
  const todayBookings = bookings.filter(b => b.date === today && b.status !== 'cancelled')
  const memberCount = members.filter(m => (m as any).membership_tier !== 'casual').length

  // Trend comparisons for the stat cards -- same day last week for
  // day-scoped figures, 7 days ago for the member count (which has no
  // "today" of its own, just a running total). null means "not enough
  // history to compare" (the prior period was zero) rather than a
  // misleading divide-by-zero infinity.
  const sevenDaysAgo = (() => { const d = new Date(today + 'T00:00:00'); d.setDate(d.getDate() - 7); return localDateStr(d) })()
  const pctChange = (curr: number, prev: number): number | null => {
    if (prev === 0) return curr > 0 ? null : 0
    return Math.round(((curr - prev) / prev) * 100)
  }

  const lastWeekBookings = bookings.filter(b => b.date === sevenDaysAgo && b.status !== 'cancelled')
  const bookingsTrend = pctChange(todayBookings.length, lastWeekBookings.length)

  const todayConfirmed = todayBookings.filter(b => b.status === 'confirmed')
  const lastWeekConfirmed = lastWeekBookings.filter(b => b.status === 'confirmed')
  const playersTrend = pctChange(
    new Set(todayConfirmed.map((b: any) => b.user_id).filter(Boolean)).size,
    new Set(lastWeekConfirmed.map((b: any) => b.user_id).filter(Boolean)).size
  )
  const playersToday = new Set(todayConfirmed.map((b: any) => b.user_id).filter(Boolean)).size

  const revenueTodayByCurrency = sumByCurrency(todayConfirmed, b => currencyForVenueSlug(b.courts?.venue_slug), b => b.price_nzd)
  const revenueTodayTotal = revenueTodayByCurrency.reduce((s, r) => s + r.amount, 0)
  const revenueLastWeekTotal = sumByCurrency(lastWeekConfirmed, b => currencyForVenueSlug(b.courts?.venue_slug), b => b.price_nzd)
    .reduce((s, r) => s + r.amount, 0)
  const revenueTrend = pctChange(revenueTodayTotal, revenueLastWeekTotal)

  // Proxy for "how has the paying-member count moved" -- there's no
  // historical snapshot of the count itself, so this compares today's
  // count against what it would have been 7 days ago based on join dates
  // alone (downgrades/upgrades since then aren't reflected, only growth).
  const memberCountAsOf7DaysAgo = members.filter(m => (m as any).membership_tier !== 'casual' && (m as any).created_at?.slice(0, 10) <= sevenDaysAgo).length
  const membersTrend = pctChange(memberCount, memberCountAsOf7DaysAgo)

  // Sparkline series for the stat cards -- same underlying figures as the
  // trend badges above, just spread across the trailing 7 days instead of
  // collapsed to a single day-over-day comparison.
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today + 'T00:00:00')
    d.setDate(d.getDate() - (6 - i))
    return localDateStr(d)
  })
  const bookingsSpark = last7Days.map(d => bookings.filter(b => b.date === d && b.status !== 'cancelled').length)
  const playersSpark = last7Days.map(d => {
    const confirmed = bookings.filter(b => b.date === d && b.status === 'confirmed')
    return new Set(confirmed.map((b: any) => b.user_id).filter(Boolean)).size
  })
  const revenueSpark = last7Days.map(d => {
    const confirmed = bookings.filter(b => b.date === d && b.status === 'confirmed')
    return sumByCurrency(confirmed, b => currencyForVenueSlug(b.courts?.venue_slug), b => b.price_nzd).reduce((s, r) => s + r.amount, 0)
  })
  const membersSpark = last7Days.map(d => members.filter(m => (m as any).membership_tier !== 'casual' && (m as any).created_at?.slice(0, 10) <= d).length)

  const venuesWithCourts = VENUES.filter(v => v.isLive && courts.some((c: any) => c.venue_slug === v.slug))
  // Courts tab needs to offer every *live* venue, including one with no
  // courts yet -- that's exactly the "onboard a new club's first courts"
  // case this tab exists to support. lib/venues.ts also carries a long list
  // of not-yet-signed "coming soon" venues used for marketing/expansion
  // planning (isLive: false) -- those aren't real clubs in this deployment
  // and would just clutter an admin's venue picker with places they don't
  // run. Board/Bookings only make sense for a venue that already has courts
  // to show, so they stay scoped to that subset of the live ones.
  const liveVenues = VENUES.filter(v => v.isLive)
  // A country-scoped club owner (managed_country, no specific venue) can
  // add courts to any live venue in their own country -- including a
  // brand-new one with zero courts yet -- but should never see another
  // country's venues here at all, even ones with no courts to filter by.
  const selectableVenues = managedVenueSlug
    ? liveVenues.filter(v => v.slug === managedVenueSlug)
    : managedCountry
    ? liveVenues.filter(v => COUNTRIES.find(c => c.name === managedCountry)?.regions.includes(v.region))
    : liveVenues
  const courtTabVenues = selectableVenues

  // Country -> City -> Venue drill-down, scoped to whichever venue list the
  // current tab cares about. Each level only matters once it actually has
  // more than one option -- with a single live NZ venue today this
  // collapses to just the venue name, and grows into real navigation once
  // more cities/countries go live without any code changes needed.
  const venuesForTab = tab === 'courts' ? courtTabVenues : venuesWithCourts
  const availableCountries = COUNTRIES.filter(c => venuesForTab.some(v => c.regions.includes(v.region)))
  const defaultVenue = venuesForTab.find(v => v.slug === managedVenueSlug) ?? venuesForTab[0]
  const activeCountryName = selectedCountry && availableCountries.some(c => c.name === selectedCountry)
    ? selectedCountry
    : availableCountries.find(c => c.regions.includes(defaultVenue?.region ?? ''))?.name ?? availableCountries[0]?.name ?? ''
  const citiesInCountry = Array.from(new Set(
    venuesForTab
      .filter(v => availableCountries.find(c => c.name === activeCountryName)?.regions.includes(v.region))
      .map(v => v.region)
  ))
  const activeCityName = selectedCity && citiesInCountry.includes(selectedCity)
    ? selectedCity
    : (citiesInCountry.includes(defaultVenue?.region ?? '') ? defaultVenue?.region : citiesInCountry[0]) ?? ''
  const venuesInCity = venuesForTab.filter(v => v.region === activeCityName)
  const activeVenue = selectedVenueSlug && venuesInCity.some(v => v.slug === selectedVenueSlug)
    ? selectedVenueSlug
    : managedVenueSlug || venuesInCity[0]?.slug || ''

  const venueCourts = courts.filter((c: any) => c.venue_slug === activeVenue)
  const venueCourtIds = new Set(venueCourts.map(c => c.id))

  const bookingsForVenue = bookings.filter((b: any) => venueCourtIds.has(b.court_id))
  const visibleBookings = bookingsForVenue
    .filter(b => showPastBookings || b.date >= today)
    .sort((a, b) => (a.date === b.date ? a.start_time.localeCompare(b.start_time) : a.date.localeCompare(b.date)))

  // Every venue in lib/venues.ts names its courts generically ("Court 1",
  // "Court 2"...), so leaving this unscoped mixes different venues' courts
  // together under the same display name in the leaderboard -- same
  // venueCourtIds scoping as bookingsForVenue above.
  const courtPerfForVenue = courtPerfBookings.filter(b => venueCourtIds.has(b.court_id))

  const upcomingBookings = bookingsForVenue
    .filter(b => b.status !== 'cancelled' && b.status !== 'blocked' && b.date >= today)
    .sort((a, b) => (a.date === b.date ? a.start_time.localeCompare(b.start_time) : a.date.localeCompare(b.date)))
    .slice(0, 8)
    .map(b => ({
      id: b.id,
      date: b.date,
      start_time: b.start_time,
      court_name: b.courts?.name ?? 'Court',
      member_name: b.profiles?.full_name ?? '—',
      price_nzd: b.price_nzd,
      venue_slug: b.courts?.venue_slug,
    }))

  // Today's Bookings Overview donut -- same category split as the Board
  // grid's own colour-coding (see BoardView's cellAppearance below), just
  // counted instead of rendered as cells.
  const publicBookingIdSet = new Set(publicBookingIds)
  const todayVenueBookings = bookingsForVenue.filter((b: any) => b.date === today && b.status !== 'cancelled')
  const todayCounts = {
    blocked: todayVenueBookings.filter(b => b.status === 'blocked').length,
    openPlay: todayVenueBookings.filter(b => b.status !== 'blocked' && publicBookingIdSet.has(b.id)).length,
    regular: todayVenueBookings.filter(b => b.status !== 'blocked' && !publicBookingIdSet.has(b.id)).length,
  }

  // Footer summary strip -- all four figures share the same trailing-7-day
  // window as the "This week" label implies, rather than mixing windows.
  const sixDaysAgo = (() => { const d = new Date(today + 'T00:00:00'); d.setDate(d.getDate() - 6); return localDateStr(d) })()
  const prevWeekStart = (() => { const d = new Date(today + 'T00:00:00'); d.setDate(d.getDate() - 13); return localDateStr(d) })()
  const thisWeekVenueBookings = bookingsForVenue.filter((b: any) => b.date >= sixDaysAgo && b.date <= today && b.status === 'confirmed')
  const prevWeekVenueBookings = bookingsForVenue.filter((b: any) => b.date >= prevWeekStart && b.date < sixDaysAgo && b.status === 'confirmed')
  const thisWeekTrend = pctChange(thisWeekVenueBookings.length, prevWeekVenueBookings.length)

  const hourCounts = new Map<string, number>()
  for (const b of thisWeekVenueBookings) {
    const h = b.start_time.slice(0, 5)
    hourCounts.set(h, (hourCounts.get(h) ?? 0) + 1)
  }
  let peakTime: string | null = null
  let peakCount = 0
  hourCounts.forEach((c, h) => { if (c > peakCount) { peakCount = c; peakTime = h } })

  const courtCounts = new Map<string, number>()
  for (const b of thisWeekVenueBookings) {
    const cid = (b as any).court_id
    courtCounts.set(cid, (courtCounts.get(cid) ?? 0) + 1)
  }
  let mostPopularCourtId: string | null = null
  let mostPopularCourtCount = 0
  courtCounts.forEach((c, cid) => { if (c > mostPopularCourtCount) { mostPopularCourtCount = c; mostPopularCourtId = cid } })
  const mostPopularCourtName = mostPopularCourtId ? venueCourts.find(c => c.id === mostPopularCourtId)?.name ?? null : null

  const avgDurationMin = thisWeekVenueBookings.length > 0
    ? Math.round(thisWeekVenueBookings.reduce((s, b: any) => s + (b.duration_minutes ?? 60), 0) / thisWeekVenueBookings.length)
    : null
  const avgDurationLabel = avgDurationMin === null ? null
    : avgDurationMin >= 60 ? `${Math.floor(avgDurationMin / 60)}h${avgDurationMin % 60 ? ' ' + (avgDurationMin % 60) + 'm' : ''}`
    : `${avgDurationMin}m`

  const financialReportBookings = bookingsForVenue.map(b => ({
    date: b.date,
    status: b.status,
    price_nzd: b.price_nzd,
    payment_method: b.payment_method,
    stripe_payment_id: b.stripe_payment_id ?? null,
    venue_slug: b.courts?.venue_slug,
    start_time: b.start_time,
    court_name: b.courts?.name ?? 'Court',
    member_name: b.profiles?.full_name ?? '—',
  }))

  const memberTiers = Array.from(new Set(members.map(m => m.membership_tier))).sort()
  const memberSearchTerm = memberSearch.trim().toLowerCase()
  const visibleMembers = members.filter(m => {
    if (memberTierFilter !== 'all' && m.membership_tier !== memberTierFilter) return false
    if (!memberSearchTerm) return true
    const haystack = [
      (m as any).nickname, m.full_name, (m as any).member_number != null ? `#${(m as any).member_number}` : null,
    ].filter(Boolean).join(' ').toLowerCase()
    return haystack.includes(memberSearchTerm)
  })

  const cancelBooking = async (id: string) => {
    if (!confirm('Cancel this booking? If it was paid, the member will be refunded per the standard cancellation policy (full refund 24h+ out, 50% credit under 24h).')) return
    const res = await fetch('/api/admin/cancel-booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId: id }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? 'Could not cancel booking')
      return
    }
    const currency = currencyForVenueSlug(bookings.find(b => b.id === id)?.courts?.venue_slug)
    const message = data.refundFailed
      ? 'Booking cancelled, but the refund could not be processed automatically — check Stripe.'
      : !data.isPaid
      ? 'Booking cancelled.'
      : data.creditsRefunded > 0
      ? 'Booking cancelled. 1 session credit refunded.'
      : data.creditAmount > 0
      ? `Booking cancelled. ${formatPrice(data.creditAmount, currency)} credit added for the member.`
      : 'Booking cancelled. Full refund issued to the member\'s card.'
    if (data.refundFailed) toast.error(message, { duration: 8000 })
    else toast.success(message)
    router.refresh()
  }

  const blockCourt = async () => {
    const court = courts.find(c => c.id === blockForm.courtId)
    if (!court) return
    const { createClient } = await import('@/lib/supabase-browser')
    const supabase = createClient()
    const user = await supabase.auth.getUser()
    const endHour = String(parseInt(blockForm.time.split(':')[0]) + 1).padStart(2, '0')
    const { error } = await supabase.from('bookings').insert({
      user_id: user.data.user?.id,
      court_id: blockForm.courtId,
      date: blockForm.date,
      start_time: blockForm.time + ':00',
      end_time: endHour + ':00:00',
      duration_minutes: 60,
      status: 'blocked',
      price_nzd: 0,
      payment_method: 'staff_block',
      notes: blockForm.notes || 'Blocked by staff',
    })
    if (error?.code === '23505') {
      toast.error('That slot is already taken.')
    } else if (error) {
      toast.error(error.message)
    } else {
      toast.success('Court blocked')
      setShowBlock(false)
      router.refresh()
    }
  }

  const openAddCourt = () => {
    setCourtForm({ name: '', type: '', price_per_hour: '', price_per_hour_peak: '', is_active: true, is_indoor: true, description: '' })
    setEditingCourt('new')
  }

  const openEditCourt = (court: Court) => {
    setCourtForm({
      name: court.name,
      type: court.type,
      price_per_hour: String(court.price_per_hour),
      price_per_hour_peak: (court as any).price_per_hour_peak != null ? String((court as any).price_per_hour_peak) : '',
      is_active: court.is_active,
      is_indoor: court.is_indoor,
      description: (court as any).description ?? '',
    })
    setEditingCourt(court)
  }

  const saveCourt = async () => {
    if (!courtForm.name.trim() || !courtForm.type.trim() || !courtForm.price_per_hour) {
      toast.error('Name, type and price are required')
      return
    }
    setSavingCourt(true)
    const { createClient } = await import('@/lib/supabase-browser')
    const supabase = createClient()
    const payload = {
      name: courtForm.name.trim(),
      type: courtForm.type.trim(),
      price_per_hour: parseFloat(courtForm.price_per_hour),
      price_per_hour_peak: courtForm.price_per_hour_peak ? parseFloat(courtForm.price_per_hour_peak) : null,
      is_active: courtForm.is_active,
      is_indoor: courtForm.is_indoor,
      description: courtForm.description.trim() || null,
    }
    const { error } = editingCourt === 'new'
      ? await supabase.from('courts').insert({ ...payload, venue_slug: activeVenue })
      : await supabase.from('courts').update(payload).eq('id', (editingCourt as Court).id)
    setSavingCourt(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success(editingCourt === 'new' ? 'Court added' : 'Court updated')
    setEditingCourt(null)
    router.refresh()
  }

  const heroVenue = activeVenue ? getVenue(activeVenue) : null
  const heroHour = new Date().getHours()
  const heroGreeting = heroHour < 12 ? 'Good morning' : heroHour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="flex gap-6">
      <AdminSidebar tab={tab} setTab={setTab} venueName={heroVenue?.name ?? 'Your club'} venueRegion={heroVenue?.region ?? ''} staffName={staffName} />
      <div className="flex-1 min-w-0">
      {/* Hero greeting */}
      <div className="rounded-2xl p-5 mb-6" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
        <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--brand-primary-text)' }}>{heroVenue?.name ?? 'Your club'}</div>
        <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{heroGreeting}{staffName ? `, ${staffName}` : ''}</div>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mt-1">
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Here's what's happening at your club today.</div>
          <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>{formatDate(today)}</div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Today's bookings", value: todayBookings.length, color: 'var(--brand-primary-text)', trend: bookingsTrend, trendLabel: 'vs same day last week', spark: bookingsSpark },
          { label: 'Players today',    value: playersToday, color: 'var(--text-primary)', trend: playersTrend, trendLabel: 'vs same day last week', spark: playersSpark },
          { label: 'Revenue today',    value: formatMultiCurrency(revenueTodayByCurrency), color: 'var(--brand-primary-text)', trend: revenueTrend, trendLabel: 'vs same day last week', spark: revenueSpark },
          { label: 'Paying members',   value: memberCount, color: 'var(--brand-accent)', trend: membersTrend, trendLabel: 'vs 7 days ago', spark: membersSpark },
        ].map(({ label, value, color, trend, trendLabel, spark }) => (
          <div key={label} className="rounded-2xl p-4 flex items-center justify-between gap-3"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
            <div className="min-w-0">
              <div className="text-xs mb-1" style={{ color: 'var(--text-subtle)' }}>{label}</div>
              <div className="flex items-baseline gap-2 flex-wrap">
                <div className="text-xl font-semibold" style={{ color }}>{value}</div>
                {trend !== null && (
                  <span className="text-[11px] font-bold" style={{ color: trend > 0 ? 'var(--brand-primary-text)' : trend < 0 ? 'var(--brand-crimson)' : 'var(--text-subtle)' }}>
                    {trend > 0 ? '↑' : trend < 0 ? '↓' : '–'}{Math.abs(trend)}%
                  </span>
                )}
              </div>
              <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-subtle)' }}>{trendLabel}</div>
            </div>
            <Sparkline data={spark} color={color} />
          </div>
        ))}
      </div>

      {/* Tabs -- mobile only; md+ uses the sidebar instead */}
      <div className="flex gap-1 mb-4 md:hidden overflow-x-auto" style={{ borderBottom: '1px solid var(--border)' }}>
        {(['board', 'analytics', 'reports', 'bookings', 'members', 'courts', 'xero'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-2 text-sm capitalize transition-colors"
            style={{
              borderBottom: `2px solid ${tab === t ? 'var(--brand-primary)' : 'transparent'}`,
              color: tab === t ? 'var(--brand-primary-text)' : 'var(--text-muted)',
              fontWeight: tab === t ? 500 : 400,
              marginBottom: -1,
            }}
          >
            {t}
          </button>
        ))}
        <div className="flex-1" />
        {tab === 'bookings' && (
          <button className="btn btn-primary btn-sm mb-1" onClick={() => setShowBlock(true)}>
            🔒 Block a court
          </button>
        )}
      </div>

      {/* Venue selector - shared across Board / Bookings / Courts */}
      {((tab === 'board' || tab === 'bookings' || tab === 'analytics' || tab === 'reports') && venuesWithCourts.length > 0) || (tab === 'courts' && courtTabVenues.length > 0) ? (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          {managedVenueSlug ? (
            <div className="text-sm font-medium px-1" style={{ color: 'var(--text-primary)' }}>
              {(venuesWithCourts[0] ?? selectableVenues[0])?.name ?? managedVenueSlug} — {(venuesWithCourts[0] ?? selectableVenues[0])?.region ?? ''}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {availableCountries.length > 1 && (
                <select className="input text-sm w-auto" value={activeCountryName}
                  onChange={e => { setSelectedCountry(e.target.value); setSelectedCity(''); setSelectedVenueSlug('') }}>
                  {availableCountries.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              )}
              {citiesInCountry.length > 1 && (
                <select className="input text-sm w-auto" value={activeCityName}
                  onChange={e => { setSelectedCity(e.target.value); setSelectedVenueSlug('') }}>
                  {citiesInCountry.map(city => <option key={city} value={city}>{city}</option>)}
                </select>
              )}
              {venuesInCity.length > 1 ? (
                <select className="input text-sm w-auto" value={activeVenue} onChange={e => setSelectedVenueSlug(e.target.value)}>
                  {venuesInCity.map(v => <option key={v.slug} value={v.slug}>{v.name}</option>)}
                </select>
              ) : (
                <div className="text-sm font-medium px-1" style={{ color: 'var(--text-primary)' }}>
                  {venuesInCity[0]?.name ?? ''}{citiesInCountry.length <= 1 ? ` — ${venuesInCity[0]?.region ?? ''}` : ''}
                </div>
              )}
            </div>
          )}
          {tab === 'bookings' && (
            <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--text-muted)' }}>
              <input type="checkbox" checked={showPastBookings} onChange={e => setShowPastBookings(e.target.checked)} />
              Show past bookings
            </label>
          )}
          {tab === 'courts' && (
            <button className="btn btn-primary btn-sm" onClick={openAddCourt}>+ Add court</button>
          )}
        </div>
      ) : null}

{/* Board tab */}
      {tab === 'board' && (
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 min-w-0">
            <BoardView bookings={bookings} venueCourts={venueCourts} boardDate={boardDate} setBoardDate={setBoardDate} viewMode={viewMode} setViewMode={setViewMode} publicBookingIds={publicBookingIds} />
            <BoardFooterStrip
              thisWeekCount={thisWeekVenueBookings.length}
              thisWeekTrend={thisWeekTrend}
              peakTime={peakTime}
              mostPopularCourtName={mostPopularCourtName}
              avgDurationLabel={avgDurationLabel}
            />
          </div>
          <BoardRightRail
            todayCounts={todayCounts}
            upcomingBookings={upcomingBookings}
            onBlockCourt={() => setShowBlock(true)}
            onAddCourt={openAddCourt}
          />
        </div>
      )}

      {tab === 'analytics' && (
        <ClubAnalytics
          data={analytics}
          courtPerfBookings={courtPerfForVenue}
          heatmapBookings={bookingsForVenue}
          courtCount={venueCourts.length}
          upcomingBookings={upcomingBookings}
        />
      )}

      {tab === 'reports' && (
        <FinancialReports bookings={financialReportBookings} creditTransactions={creditTransactions} />
      )}

      {/* Bookings tab */}
      {tab === 'bookings' && (
        <div className="rounded-2xl overflow-x-auto scrollbar-thin"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Member','Court','Date','Time','Amount','Status',''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium whitespace-nowrap"
                    style={{ color: 'var(--text-subtle)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleBookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    No {showPastBookings ? '' : 'upcoming '}bookings for this venue.
                  </td>
                </tr>
              ) : visibleBookings.map(b => (
                <tr key={b.id} className="last:border-0 transition-colors"
                  style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-raised)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                    {b.profiles?.full_name ?? '—'}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>{b.courts?.name}</td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{formatDate(b.date)}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>{b.start_time.slice(0,5)}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                    {b.price_nzd > 0 ? formatPrice(b.price_nzd, currencyForVenueSlug(b.courts?.venue_slug)) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('badge', `status-${b.status}`)}>{b.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    {b.status !== 'cancelled' && b.status !== 'blocked' && (
                      <button className="btn btn-danger btn-sm" onClick={() => cancelBooking(b.id)}>
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Members tab */}
      {tab === 'members' && (
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <input type="text" className="input text-sm w-auto flex-1 min-w-[180px]" placeholder="Search by name or member #…"
              value={memberSearch} onChange={e => setMemberSearch(e.target.value)} />
            <select className="input text-sm w-auto" value={memberTierFilter} onChange={e => setMemberTierFilter(e.target.value)}>
              <option value="all">All memberships</option>
              {memberTiers.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
            </select>
            <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>
              {visibleMembers.length} of {members.length}
            </span>
          </div>
          <div className="rounded-2xl overflow-x-auto scrollbar-thin"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['#','Name','Membership','Credits','Role','Joined'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium"
                      style={{ color: 'var(--text-subtle)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleMembers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                      No members match your search.
                    </td>
                  </tr>
                ) : visibleMembers.map(m => (
                  <tr key={m.id} className="last:border-0 transition-colors"
                    style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-raised)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-subtle)' }}>
                      #{(m as any).member_number ?? '—'}
                    </td>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                      {(m as any).nickname ?? m.full_name ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="badge badge-member capitalize">{m.membership_tier}</span>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--brand-primary-text)' }}>{m.credits}</td>
                    <td className="px-4 py-3 capitalize" style={{ color: 'var(--text-muted)' }}>{m.role}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-subtle)' }}>
                      {(m as any).created_at?.slice(0,10)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Courts tab */}
      {tab === 'courts' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {venueCourts.length === 0 ? (
            <div className="rounded-xl text-center py-12 text-sm sm:col-span-2" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              No courts yet for this venue.
              <div className="mt-3">
                <button className="btn btn-primary btn-sm" onClick={openAddCourt}>+ Add the first court</button>
              </div>
            </div>
          ) : venueCourts.map(c => (
            <button key={c.id} onClick={() => openEditCourt(c)} className="text-left rounded-2xl p-5 transition-colors"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-raised)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-surface)')}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{c.name}</div>
                  <div className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {c.is_indoor ? '🏢' : '☀️'} {c.type} · {(c as any).sport}
                  </div>
                </div>
                <span className={cn('badge', c.is_active ? 'badge-member' : 'status-cancelled')}>
                  {c.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                {formatPrice(c.price_per_hour, currencyForVenueSlug((c as any).venue_slug))}/hr{(c as any).price_per_hour_peak != null ? ` · ${formatPrice((c as any).price_per_hour_peak, currencyForVenueSlug((c as any).venue_slug))}/hr peak` : ''} · {(c as any).surface}
              </div>
              {(c as any).description && (
                <div className="text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>{(c as any).description}</div>
              )}
            </button>
          ))}
        </div>
      )}

      {tab === 'xero' && <XeroSettingsPanel />}

      {/* Block court modal */}
      {showBlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={e => e.target === e.currentTarget && setShowBlock(false)}>
          <div className="rounded-2xl p-6 w-full max-w-sm"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
            <div className="font-semibold text-base mb-4" style={{ color: 'var(--text-primary)' }}>
              Block court time
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Court</label>
                <select className="input" value={blockForm.courtId}
                  onChange={e => setBlockForm(f => ({...f, courtId: e.target.value}))}>
                  {courts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Date</label>
                  <input type="date" className="input" value={blockForm.date}
                    onChange={e => setBlockForm(f => ({...f, date: e.target.value}))} />
                </div>
                <div>
                  <label className="label">Time</label>
                  <select className="input" value={blockForm.time}
                    onChange={e => setBlockForm(f => ({...f, time: e.target.value}))}>
                    {TIME_SLOTS.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Reason (optional)</label>
                <input type="text" className="input" placeholder="Maintenance, private event…"
                  value={blockForm.notes}
                  onChange={e => setBlockForm(f => ({...f, notes: e.target.value}))} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button className="btn flex-1 justify-center" onClick={() => setShowBlock(false)}>Cancel</button>
              <button className="btn btn-primary flex-1 justify-center" onClick={blockCourt}>Block court</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/edit court modal */}
      {editingCourt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={e => e.target === e.currentTarget && setEditingCourt(null)}>
          <div className="rounded-2xl p-6 w-full max-w-sm"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
            <div className="font-semibold text-base mb-4" style={{ color: 'var(--text-primary)' }}>
              {editingCourt === 'new' ? 'Add court' : 'Edit court'}
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Name</label>
                <input type="text" className="input" placeholder="Court 5"
                  value={courtForm.name}
                  onChange={e => setCourtForm(f => ({...f, name: e.target.value}))} />
              </div>
              <div>
                <label className="label">Type</label>
                <input type="text" className="input" placeholder="Glass-backed"
                  value={courtForm.type}
                  onChange={e => setCourtForm(f => ({...f, type: e.target.value}))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Price / hr</label>
                  <input type="number" step="0.01" min="0" className="input" placeholder="70.00"
                    value={courtForm.price_per_hour}
                    onChange={e => setCourtForm(f => ({...f, price_per_hour: e.target.value}))} />
                </div>
                <div>
                  <label className="label">Peak price (optional)</label>
                  <input type="number" step="0.01" min="0" className="input" placeholder="80.00"
                    value={courtForm.price_per_hour_peak}
                    onChange={e => setCourtForm(f => ({...f, price_per_hour_peak: e.target.value}))} />
                </div>
              </div>
              <div>
                <label className="label">Description (optional)</label>
                <input type="text" className="input" placeholder="Premium indoor glass court"
                  value={courtForm.description}
                  onChange={e => setCourtForm(f => ({...f, description: e.target.value}))} />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-primary)' }}>
                  <input type="checkbox" checked={courtForm.is_indoor}
                    onChange={e => setCourtForm(f => ({...f, is_indoor: e.target.checked}))} />
                  Indoor
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-primary)' }}>
                  <input type="checkbox" checked={courtForm.is_active}
                    onChange={e => setCourtForm(f => ({...f, is_active: e.target.checked}))} />
                  Active
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button className="btn flex-1 justify-center" onClick={() => setEditingCourt(null)}>Cancel</button>
              <button className="btn btn-primary flex-1 justify-center" disabled={savingCourt} onClick={saveCourt}>
                {savingCourt ? 'Saving…' : editingCourt === 'new' ? 'Add court' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}


function BoardView({
  bookings, venueCourts, viewMode, setViewMode, boardDate, setBoardDate, publicBookingIds,
}: {
  bookings: any[]
  venueCourts: Court[]
  viewMode: 'day' | 'week' | 'month'
  setViewMode: (m: 'day' | 'week' | 'month') => void
  boardDate: string
  setBoardDate: (d: string) => void
  publicBookingIds: string[]
}) {
  const router = useRouter()
  const [dayDetail, setDayDetail] = useState<string | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverDate, setDragOverDate] = useState<string | null>(null)
  const [dragOverCell, setDragOverCell] = useState<string | null>(null)
  const [moving, setMoving] = useState(false)
  const [dayLayout, setDayLayout] = useState<'grid' | 'list'>('grid')
  const publicBookingIdSet = new Set(publicBookingIds)

  // A single place to decide how a booking cell looks: a staff-blocked slot
  // reads as unavailable rather than a real booking (and its "booker" is
  // actually whichever staff member blocked it, not a real customer, so a
  // name there is more confusing than useful); a public find-a-game match
  // gets its own colour so staff can spot an open-to-anyone slot at a
  // glance, distinct from an ordinary private booking.
  const cellAppearance = (b: any): { background: string; color: string; label: string } => {
    if (b.status === 'blocked') {
      return { background: 'var(--brand-crimson-muted)', color: 'var(--brand-crimson)', label: 'Blocked' }
    }
    if (publicBookingIdSet.has(b.id)) {
      return { background: '#10B98133', color: '#10B981', label: b.profiles?.full_name?.split(' ')[0] ?? 'Open Play' }
    }
    return { background: 'var(--brand-primary-muted)', color: 'var(--brand-primary-text)', label: b.profiles?.full_name?.split(' ')[0] ?? '—' }
  }

  const moveBooking = async (bookingId: string, changes: { newDate?: string; newCourtId?: string; newStartTime?: string }) => {
    setMoving(true)
    const res = await fetch('/api/admin/reschedule-booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId, ...changes }),
    })
    const data = await res.json()
    setMoving(false)
    if (!res.ok) {
      toast.error(data.error ?? 'Could not reschedule booking')
      return
    }
    toast.success('Booking moved')
    router.refresh()
  }

  const dayLabel = (d: string) => {
    const date = new Date(d + 'T00:00:00')
    return date.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  const shiftDate = (dir: 1 | -1) => {
    const base = new Date(boardDate + 'T00:00:00')
    const days = viewMode === 'day' ? 1 : viewMode === 'week' ? 7 : 30
    base.setDate(base.getDate() + dir * days)
    setBoardDate(localDateStr(base))
  }

  const getWeekDates = () => {
    const base = new Date(boardDate + 'T00:00:00')
    const day = base.getDay()
    const monday = new Date(base)
    monday.setDate(base.getDate() - ((day + 6) % 7))
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      return localDateStr(d)
    })
  }

  const TIME_ROWS = Array.from({ length: 16 }, (_, i) => String(7 + i).padStart(2, '0') + ':00')
  const weekDates = getWeekDates()
  const today = localDateStr()
  const courtColors = ['var(--brand-primary)', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4', '#10B981']
  const colorMap: Record<string, string> = {}
  venueCourts.forEach((court: any, i: number) => { colorMap[court.id] = courtColors[i % courtColors.length] })

  const title = viewMode === 'month'
    ? new Date(boardDate + 'T00:00:00').toLocaleDateString('en-NZ', { month: 'long', year: 'numeric' })
    : viewMode === 'week'
    ? dayLabel(weekDates[0]) + ' – ' + dayLabel(weekDates[6])
    : dayLabel(boardDate)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => shiftDate(-1)} className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>←</button>
          <span className="text-sm font-medium px-2" style={{ color: 'var(--text-primary)' }}>{title}</span>
          <button onClick={() => shiftDate(1)} className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>→</button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-lg p-1" style={{ background: 'var(--bg-raised)' }}>
            {(['day', 'week', 'month'] as const).map(m => (
              <button key={m} onClick={() => setViewMode(m)}
                className="px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all"
                style={{ background: viewMode === m ? 'var(--brand-primary)' : 'transparent', color: viewMode === m ? 'var(--brand-primary-on)' : 'var(--text-muted)' }}>
                {m}
              </button>
            ))}
          </div>
          {viewMode === 'day' && (
            <div className="flex gap-1 rounded-lg p-1" style={{ background: 'var(--bg-raised)' }}>
              {(['grid', 'list'] as const).map(m => (
                <button key={m} onClick={() => setDayLayout(m)}
                  className="px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all"
                  style={{ background: dayLayout === m ? 'var(--brand-primary)' : 'transparent', color: dayLayout === m ? 'var(--brand-primary-on)' : 'var(--text-muted)' }}>
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {viewMode === 'day' && (
        <div className="flex items-center gap-2">
          <button onClick={() => { const d = new Date(boardDate + 'T00:00:00'); d.setDate(d.getDate() - 7); setBoardDate(localDateStr(d)) }}
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>‹</button>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-thin flex-1 pb-1">
            {Array.from({ length: 7 }, (_, i) => {
              const d = new Date(boardDate + 'T00:00:00')
              d.setDate(d.getDate() + i)
              return localDateStr(d)
            }).map(d => (
              <button key={d} onClick={() => setBoardDate(d)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors"
                style={{
                  background: d === boardDate ? 'var(--brand-primary)' : 'var(--bg-raised)',
                  color: d === boardDate ? 'var(--brand-primary-on)' : (d === today ? 'var(--brand-primary-text)' : 'var(--text-muted)'),
                  border: `1px solid ${d === boardDate ? 'var(--brand-primary)' : 'var(--border)'}`,
                }}>
                {dayLabel(d)}
              </button>
            ))}
          </div>
          <button onClick={() => { const d = new Date(boardDate + 'T00:00:00'); d.setDate(d.getDate() + 7); setBoardDate(localDateStr(d)) }}
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>›</button>
        </div>
      )}

      {venueCourts.length === 0 ? (
        <div className="rounded-xl text-center py-12 text-sm" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          No courts found for this venue.
        </div>
      ) : viewMode === 'month' ? (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
              <div key={d} style={{ padding: '6px 4px', textAlign: 'center', fontSize: 11, color: 'var(--text-primary)', fontWeight: 700, letterSpacing: 0.3, background: 'var(--bg-raised)', borderBottom: '1px solid var(--border)' }}>{d}</div>
            ))}
            {(() => {
              const base = new Date(boardDate + 'T00:00:00')
              const year = base.getFullYear()
              const month = base.getMonth()
              const firstDay = new Date(year, month, 1).getDay()
              const daysInMonth = new Date(year, month + 1, 0).getDate()
              const cells: { date: string; otherMonth: boolean }[] = []
              for (let i = 0; i < firstDay; i++) {
                const d = new Date(year, month, -firstDay + i + 1)
                cells.push({ date: localDateStr(d), otherMonth: true })
              }
              for (let i = 1; i <= daysInMonth; i++) {
                cells.push({ date: localDateStr(new Date(year, month, i)), otherMonth: false })
              }
              const remaining = 7 - (cells.length % 7)
              if (remaining < 7) for (let i = 1; i <= remaining; i++) cells.push({ date: localDateStr(new Date(year, month + 1, i)), otherMonth: true })
              return cells.map(({ date, otherMonth }, idx) => {
                const dayBookings = bookings.filter((b: any) => b.date === date && venueCourts.some((c: any) => c.id === b.court_id) && b.status !== 'cancelled')
                const isToday = date === today
                const dayNum = parseInt(date.slice(8, 10))
                const show = dayBookings.slice(0, 2)
                const extra = dayBookings.length - 2
                const isPast = date < today
                const isDragOver = dragOverDate === date && !isPast
                return (
                  <div key={idx} onClick={() => dayBookings.length > 0 && setDayDetail(date)}
                    onDragOver={e => { if (!isPast) { e.preventDefault(); setDragOverDate(date) } }}
                    onDragLeave={() => setDragOverDate(prev => (prev === date ? null : prev))}
                    onDrop={e => {
                      e.preventDefault()
                      setDragOverDate(null)
                      const id = e.dataTransfer.getData('text/booking-id') || draggedId
                      setDraggedId(null)
                      if (!id || isPast) return
                      const dragged = bookings.find((b: any) => b.id === id)
                      if (dragged && dragged.date === date) return // dropped back on its own day, nothing to do
                      moveBooking(id, { newDate: date })
                    }}
                    style={{ borderRight: (idx + 1) % 7 === 0 ? 'none' : '1px solid var(--border)', borderBottom: '1px solid var(--border)', minHeight: 76, padding: 4, background: isDragOver ? 'var(--brand-primary-muted)' : isToday ? 'rgba(0,255,135,0.14)' : 'var(--bg-surface)', boxShadow: isDragOver ? 'inset 0 0 0 2px var(--brand-primary)' : isToday ? 'inset 0 0 0 1px var(--brand-primary)' : 'none', opacity: otherMonth ? 0.4 : 1, cursor: dayBookings.length > 0 ? 'pointer' : 'default', transition: 'background 0.1s' }}>
                    <div style={{ fontSize: 12, fontWeight: isToday ? 800 : 600, color: isToday ? 'var(--brand-primary-text)' : 'var(--text-primary)', marginBottom: 3 }}>{dayNum}</div>
                    {show.map((b: any) => {
                      const color = colorMap[b.court_id] ?? 'var(--brand-primary)'
                      return (
                        <div key={b.id}
                          draggable={!isPast && !moving}
                          onDragStart={e => {
                            e.stopPropagation()
                            e.dataTransfer.setData('text/booking-id', b.id)
                            e.dataTransfer.effectAllowed = 'move'
                            setDraggedId(b.id)
                          }}
                          onDragEnd={() => { setDraggedId(null); setDragOverDate(null) }}
                          title={!isPast ? 'Drag to another day to reschedule' : undefined}
                          style={{ fontSize: 11, fontWeight: 600, padding: '2px 5px', borderRadius: 3, marginBottom: 2, background: isPast ? 'rgba(170,170,170,0.3)' : color + '38', color: isPast ? 'rgba(255,255,255,0.8)' : color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: isPast ? 'line-through' : 'none', cursor: isPast ? 'default' : 'grab', opacity: draggedId === b.id ? 0.4 : 1 }}>
                          {b.start_time.slice(0,5)} · {b.profiles?.full_name?.split(' ')[0] ?? '?'}
                        </div>
                      )
                    })}
                    {extra > 0 && <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--brand-primary-text)', padding: '0 4px' }}>+{extra} more</div>}
                  </div>
                )
              })
            })()}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
            {venueCourts.map((court: any, i: number) => (
              <div key={court.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: courtColors[i % courtColors.length] }} />
                {court.name}
              </div>
            ))}
          </div>
        </div>
      ) : viewMode === 'week' ? (
        <div className="rounded-2xl overflow-x-auto scrollbar-thin" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 px-3 py-2 text-left font-semibold whitespace-nowrap" style={{ background: 'var(--bg-raised)', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>Court</th>
                {weekDates.map(d => (
                  <th key={d} className="px-2 py-2 font-semibold whitespace-nowrap text-center" style={{ color: d === today ? 'var(--brand-primary-text)' : 'var(--text-primary)', background: d === today ? 'rgba(0,255,135,0.14)' : 'var(--bg-raised)', borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', minWidth: 90 }}>
                    {dayLabel(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {venueCourts.map((court: any) => (
                <tr key={court.id}>
                  <td className="sticky left-0 px-3 py-2 font-medium whitespace-nowrap" style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
                    {court.name}
                  </td>
                  {weekDates.map(d => {
                    const dayBookings = bookings.filter((b: any) => b.date === d && b.court_id === court.id && b.status !== 'cancelled')
                    return (
                      <td key={d} className="px-1 py-1 text-center align-top" style={{ borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', minWidth: 90 }}>
                        {dayBookings.length === 0 ? <div className="h-5" /> : (
                          <div className="space-y-1">
                            {dayBookings.map((b: any) => {
                              const appearance = cellAppearance(b)
                              return (
                                <div key={b.id} className="rounded-md px-1 py-1 text-[10px] font-semibold truncate" style={{ background: appearance.background, color: appearance.color }}>
                                  {b.start_time.slice(0,5)} {appearance.label}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : dayLayout === 'list' ? (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
          {(() => {
            const dayBookings = bookings
              .filter((b: any) => b.date === boardDate && b.status !== 'cancelled')
              .sort((a: any, b: any) => a.start_time.localeCompare(b.start_time))
            if (dayBookings.length === 0) {
              return (
                <div className="px-4 py-10 text-sm text-center" style={{ color: 'var(--text-subtle)' }}>
                  No bookings for this day.
                </div>
              )
            }
            return dayBookings.map((b: any) => {
              const appearance = cellAppearance(b)
              const court = venueCourts.find((c: any) => c.id === b.court_id)
              return (
                <div key={b.id} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                  <div className="text-xs font-semibold shrink-0" style={{ color: 'var(--text-primary)', width: 44 }}>{b.start_time.slice(0, 5)}</div>
                  <div style={{ width: 8, height: 8, borderRadius: 999, background: colorMap[b.court_id] ?? 'var(--brand-primary)', flexShrink: 0 }} />
                  <div className="text-xs shrink-0 truncate" style={{ color: 'var(--text-muted)', width: 70 }}>{court?.name ?? 'Court'}</div>
                  <div className="text-xs font-semibold rounded-md px-2 py-1 truncate flex-1" style={{ background: appearance.background, color: appearance.color }}>
                    {appearance.label}
                  </div>
                  <div className="text-xs font-semibold shrink-0" style={{ color: 'var(--brand-primary-text)' }}>
                    {b.price_nzd > 0 ? formatPrice(b.price_nzd, currencyForVenueSlug(court?.venue_slug)) : '—'}
                  </div>
                </div>
              )
            })
          })()}
        </div>
      ) : (
        <div className="rounded-2xl overflow-x-auto scrollbar-thin" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 px-3 py-2 text-left font-semibold" style={{ background: 'var(--bg-raised)', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>Court</th>
                {TIME_ROWS.map(t => (
                  <th key={t} className="px-2 py-2 font-semibold whitespace-nowrap text-center" style={{ color: 'var(--text-primary)', background: 'var(--bg-raised)', borderBottom: '1px solid var(--border)', minWidth: 60 }}>{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(() => {
                const isPastDay = boardDate < today
                return venueCourts.map((court: any) => (
                <tr key={court.id}>
                  <td className="sticky left-0 px-3 py-2 font-medium whitespace-nowrap" style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
                    {court.name}
                  </td>
                  {TIME_ROWS.map(t => {
                    const b = bookings.find((b: any) => b.court_id === court.id && b.date === boardDate && b.status !== 'cancelled' && b.start_time.slice(0,5) <= t && b.end_time.slice(0,5) > t)
                    const cellKey = `${court.id}-${t}`
                    const isDragOver = dragOverCell === cellKey && !isPastDay
                    return (
                      <td key={t} className="px-1 py-1 text-center"
                        onDragOver={e => { if (!isPastDay) { e.preventDefault(); setDragOverCell(cellKey) } }}
                        onDragLeave={() => setDragOverCell(prev => (prev === cellKey ? null : prev))}
                        onDrop={e => {
                          e.preventDefault()
                          setDragOverCell(null)
                          const id = e.dataTransfer.getData('text/booking-id') || draggedId
                          setDraggedId(null)
                          if (!id || isPastDay) return
                          if (b && b.id === id) return // dropped back on one of its own occupied cells
                          moveBooking(id, { newCourtId: court.id, newStartTime: t })
                        }}
                        style={{ borderBottom: '1px solid var(--border)', minWidth: 60, background: isDragOver ? 'var(--brand-primary-muted)' : undefined, boxShadow: isDragOver ? 'inset 0 0 0 2px var(--brand-primary)' : 'none', transition: 'background 0.1s' }}>
                        {b ? (() => {
                          const appearance = cellAppearance(b)
                          return (
                            <div
                              draggable={!isPastDay && !moving}
                              onDragStart={e => {
                                e.dataTransfer.setData('text/booking-id', b.id)
                                e.dataTransfer.effectAllowed = 'move'
                                setDraggedId(b.id)
                              }}
                              onDragEnd={() => { setDraggedId(null); setDragOverCell(null) }}
                              title={!isPastDay ? 'Drag to another court or time to reschedule' : undefined}
                              className="rounded-md px-1 py-1 text-[10px] font-semibold truncate"
                              style={{ background: appearance.background, color: appearance.color, cursor: isPastDay ? 'default' : 'grab', opacity: draggedId === b.id ? 0.4 : 1 }}>
                              {appearance.label}
                            </div>
                          )
                        })() : <div className="h-5" />}
                      </td>
                    )
                  })}
                </tr>
                ))
              })()}
            </tbody>
          </table>
        </div>
      )}

      {dayDetail && (() => {
        const detailBookings = bookings
          .filter((b: any) => b.date === dayDetail && venueCourts.some((c: any) => c.id === b.court_id) && b.status !== 'cancelled')
          .sort((a: any, b: any) => a.start_time.localeCompare(b.start_time))
        const detailDate = new Date(dayDetail + 'T00:00:00')
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={e => e.target === e.currentTarget && setDayDetail(null)}>
            <div className="rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
                    {detailDate.toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {detailBookings.length} {detailBookings.length === 1 ? 'booking' : 'bookings'}
                  </div>
                </div>
                <button onClick={() => setDayDetail(null)} className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>✕</button>
              </div>
              <div className="overflow-y-auto px-5 py-3 space-y-2">
                {detailBookings.map((b: any) => {
                  const color = colorMap[b.court_id] ?? 'var(--brand-primary)'
                  return (
                    <div key={b.id} className="rounded-xl p-3" style={{ background: 'var(--bg-raised)' }}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
                          <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                            {b.profiles?.full_name ?? 'Unknown player'}
                          </div>
                        </div>
                        <div className="text-sm shrink-0" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display), Manrope, sans-serif', fontWeight: 700 }}>
                          {formatPrice(b.price_nzd, currencyForVenueSlug(b.courts?.venue_slug))}
                        </div>
                      </div>
                      <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        {b.courts?.name} · {b.start_time.slice(0, 5)}–{b.end_time.slice(0, 5)}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                          style={{ background: 'var(--brand-primary-muted)', color: 'var(--brand-primary-text)' }}>
                          {b.status}
                        </span>
                        <span className="text-[10px] capitalize" style={{ color: 'var(--text-subtle)' }}>{b.payment_method?.replace('_', ' ')}</span>
                      </div>
                      {b.notes && (
                        <div className="text-xs mt-1.5 italic" style={{ color: 'var(--text-subtle)' }}>{b.notes}</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
