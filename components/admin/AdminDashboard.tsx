'use client'

import { fmtClock, fmtClockRange, fmtHour } from '@/lib/clock'
import CardHeading from '@/components/ui/CardHeading'
import { useState, useEffect, useRef, Fragment } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { cn, formatDate, formatDateCompact, formatDateWithYear, generateTimeSlots, getNextNDates, localDateStr } from '@/lib/utils'
import type { Court, Profile } from '@/types/database'
import { VENUES, COUNTRIES, getVenue } from '@/lib/venues'
import { currencyForRegion, formatPrice, sumByCurrency, formatMultiCurrency } from '@/lib/currency'

const currencyForVenueSlug = (venueSlug: string | null | undefined) =>
  currencyForRegion(venueSlug ? getVenue(venueSlug).region : undefined)
import XeroSettingsPanel from '@/components/admin/XeroSettingsPanel'
import ClubAnalytics from '@/components/admin/ClubAnalytics'
import MoneyDemand from '@/components/admin/MoneyDemand'
import type { OfferRow } from '@/lib/offers'
import MemberPlanDialog from '@/components/admin/MemberPlanDialog'
import { effectivePlans, planOf, tierLabel, type PlanRow } from '@/lib/plan-rules'
import RegularsSummaryCard from '@/components/admin/RegularsSummaryCard'
import { ADMIN_TABS, FRONT_DESK_TABS } from '@/lib/view-mode'
import { weekBounds, type WeekHours } from '@/lib/venue-hours'
import { weekFor, type VenueSettingsMap } from '@/lib/venue-settings'
import type { UnpaidShareRow } from '@/lib/money-demand'
import type { WaitDemand } from '@/lib/waitlist-rules'
import FinancialReports from '@/components/admin/FinancialReports'
import type { RunningCosts } from '@/lib/running-costs'
import MoneyBubble, { moneyVars } from '@/components/ui/MoneyBubble'
import { bookingKind, countChange, moneyChange, weekMoney, MONEY_HEX, type MoneyKind } from '@/lib/money-colours'
import { splitOverdueShares } from '@/lib/money-demand'
import type { ReportRow } from '@/lib/report-rules'
import AdminSidebar from '@/components/admin/AdminSidebar'
import BoardRightRail from '@/components/admin/BoardRightRail'
import BoardFooterStrip from '@/components/admin/BoardFooterStrip'
import BookingRosterModal from '@/components/admin/BookingRosterModal'
import BookingCards from '@/components/admin/BookingCards'
import type { ClubAnalytics as ClubAnalyticsData, CourtPerformanceBooking, FinancialCreditTx } from '@/lib/analytics'


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

// Day and Week colour a booking by what it is, so their key names those
// categories. Month colours by court instead and carries its own key listing
// the courts -- each view's key describes that view's own colouring.
// A small blue tile for a court, like the court tile on a booking: COURT / 3. A court with a name
// that is not "Court N" keeps its name, in the same tile shape.
function CourtTile({ name, plain = false }: { name: string; plain?: boolean }) {
  const m = /^Court\s+(\d+)$/i.exec(name.trim())
  // The week grid has "Court" in its heading, so there the tile is just the number, big and centred.
  if (plain && m) return (
    <span data-testid="court-tile" className="inline-flex items-center justify-center text-white align-middle" style={{ width: 46, height: 46, borderRadius: 15, background: 'linear-gradient(160deg,#3a73dc,#1d3f8d)', fontSize: 22, fontWeight: 800, lineHeight: 1, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.28), 0 6px 14px rgba(11,30,74,0.35)' }}>{m[1]}</span>
  )
  return (
    <span className="inline-flex flex-col items-center justify-center text-white text-center align-middle" style={{ minWidth: 44, height: 36, padding: m ? 0 : '0 8px', borderRadius: 11, background: 'linear-gradient(160deg,#2c5fc4,#1d3f8d)' }}>
      {m ? (<><span style={{ fontSize: 8, letterSpacing: '0.1em', fontWeight: 700, lineHeight: 1 }}>COURT</span><span style={{ fontSize: 16, fontWeight: 800, lineHeight: 1 }}>{m[1]}</span></>) : <span style={{ fontSize: 11, fontWeight: 800 }}>{name}</span>}
    </span>
  )
}

// The web Board's legend: the colours of the status bubbles.
function BoardStatusLegend() {
  const items = [
    { label: 'Paid', color: '#1f9a5f' },
    { label: 'Pending', color: '#2f6fd6' },
    { label: 'Open play', color: '#8a94a0' },
    { label: 'Blocked', color: '#c4343a' },
  ]
  return (
    <div data-testid="board-status-legend" className="hidden md:flex" style={{ gap: 16, marginTop: 12, flexWrap: 'wrap', padding: '0 4px' }}>
      {items.map(item => (
        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)' }}>
          <div style={{ width: 9, height: 9, borderRadius: 99, background: item.color }} />
          {item.label}
        </div>
      ))}
    </div>
  )
}

// One dot per booking, in its status colour.
function StatusDots({ kinds, max = 14 }: { kinds: MoneyKind[]; max?: number }) {
  return (
    <div data-testid="board-dots" style={{ display: 'flex', flexWrap: 'wrap', gap: 3, lineHeight: 1 }}>
      {kinds.slice(0, max).map((k, i) => <span key={i} style={{ width: 8, height: 8, borderRadius: 99, background: MONEY_HEX[k], display: 'inline-block' }} />)}
    </div>
  )
}

function BoardCategoryLegend() {
  const items = [
    { label: 'Booking', color: 'var(--brand-primary)' },
    { label: 'Open play', color: '#10B981' },
    { label: 'Blocked', color: 'var(--brand-crimson)' },
  ]
  return (
    <div className="flex md:hidden" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
      {items.map(item => (
        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: 'var(--text-primary)', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 99, padding: '4px 11px' }}>
          <div style={{ width: 9, height: 9, borderRadius: 99, background: item.color }} />
          {item.label}
        </div>
      ))}
    </div>
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

export type AdminTab = 'board' | 'analytics' | 'reports' | 'bookings' | 'members' | 'courts' | 'xero'

export default function AdminDashboard({
  bookings,
  members,
  courts,
  managedVenueSlug,
  managedCountry,
  analytics,
  canSeeMoney = true,
  courtPerfBookings,
  creditTransactions,
  reportBookings = [],
  publicBookingIds,
  unpaidShares = [],
  waitDemand = null,
  offers = null,
  plans = null,
  initialTab,
  initialVenue,
  initialPlan,
  venueSettings = {},
  runningCosts = null,
  staffName,
  todayStr,
}: {
  bookings: AdminBooking[]
  members: Profile[]
  courts: Court[]
  managedVenueSlug?: string | null
  managedCountry?: string | null
  analytics: ClubAnalyticsData | null
  // Owners see money and settings; front desk does not (see lib/view-mode.ts).
  canSeeMoney?: boolean
  courtPerfBookings: CourtPerformanceBooking[]
  creditTransactions: FinancialCreditTx[]
  // About 190 days of this owner's bookings with who and what, for the Reports tab (see lib/report-rules.ts).
  reportBookings?: any[]
  publicBookingIds: string[]
  unpaidShares?: UnpaidShareRow[]
  // Waitlist demand per club for owners; null when the waitlist isn't set up.
  waitDemand?: Record<string, WaitDemand> | null
  offers?: OfferRow[] | null
  // Membership plans for the clubs this person covers; null before the club plans database change.
  plans?: PlanRow[] | null
  // Where to open (from the manager navigation and the Today screen's links).
  initialTab?: AdminTab
  initialVenue?: string
  // A membership plan to show on the Members tab (the plan tiles in Club settings link here).
  initialPlan?: string
  // Each club's opening hours (default 07:00-22:00 when a club hasn't set any).
  venueSettings?: VenueSettingsMap
  // Owners only: each club's running costs for the breakeven line on Reports. Null for front desk, or before the 042 database change.
  runningCosts?: Record<string, RunningCosts> | null
  staffName: string | null
  // "Today" as the server saw it. The first render uses this so the page matches the HTML the server sent; it is
  // then replaced by the viewer's own date (the server and a viewer in another time zone can be on different days).
  todayStr?: string
}) {
  const router = useRouter()
  const [tab, setTabState] = useState<AdminTab>(initialTab ?? 'board')
  // Keep the address in step with the tab so the manager navigation can show
  // which one is open (history.replaceState is understood by the Next.js router).
  const allowedTabs: readonly AdminTab[] = canSeeMoney ? ADMIN_TABS : FRONT_DESK_TABS
  // The bottom bar on a phone links to /admin?tab=..., which changes the address but not this page's own
  // state, so the page now follows the address too. Without this the bar said Bookings while the page
  // still showed Analytics.
  const search = useSearchParams()
  const urlTab = search?.get('tab') ?? null
  const blockCourtParam = search?.get('block') ?? null
  useEffect(() => {
    if (urlTab && (allowedTabs as readonly string[]).includes(urlTab)) setTabState(urlTab as AdminTab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlTab])
  // The phone's bottom bar changes the tab without a page load, and says so here.
  useEffect(() => {
    const on = (e: Event) => { const t = (e as CustomEvent).detail; if (typeof t === 'string' && (allowedTabs as readonly string[]).includes(t)) setTabState(t as AdminTab) }
    window.addEventListener('padelmate:tab', on)
    return () => window.removeEventListener('padelmate:tab', on)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // A link from Today's club map (Block the court) arrives with ?block=<court>: open that dialog ready to use.
  useEffect(() => {
    if (blockCourtParam && courts.some((c: any) => c.id === blockCourtParam)) {
      setShowBlock(true); setBlockForm(f => ({ ...f, courtId: blockCourtParam }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockCourtParam])
  const setTab = (t: AdminTab) => {
    if (!allowedTabs.includes(t)) return
    setTabState(t)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('tab', t)
      window.history.replaceState(null, '', url.toString())
      window.dispatchEvent(new CustomEvent('padelmate:tab', { detail: t }))
    }
  }
  const initialRegion = initialVenue ? getVenue(initialVenue).region : ''
  const [selectedVenueSlug, setSelectedVenueSlug] = useState<string>(initialVenue ?? '')
  const [selectedCountry, setSelectedCountry] = useState<string>(initialRegion ? COUNTRIES.find(c => c.regions.includes(initialRegion))?.name ?? '' : '')
  const [selectedCity, setSelectedCity] = useState<string>(initialRegion)
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week')
  const [boardDate, setBoardDate] = useState(todayStr ?? localDateStr())
  const [showBlock, setShowBlock] = useState(false)
  // Upcoming, Past or Cancelled: one switch instead of the old "Show past bookings" tick box.
  const [bookingsView, setBookingsView] = useState<'upcoming' | 'past' | 'cancelled'>('upcoming')
  const [memberSearch, setMemberSearch] = useState('')
  const [memberTierFilter, setMemberTierFilter] = useState<'all' | string>(initialPlan ?? 'all')
  const [planFor, setPlanFor] = useState<{ id: string; name: string; tier: string; home: string } | null>(null)
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

  const [today, setToday] = useState(todayStr ?? localDateStr())
  useEffect(() => {
    const t = localDateStr()
    setToday(t)
    setBoardDate(d => (d === (todayStr ?? t) ? t : d))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Deliberately not filtered by isLive. A venue with court rows in this
  // deployment is real whatever the flag says, and it may carry real bookings
  // -- taking a venue off the booking flow must never take staff's view of
  // its existing bookings away with it. The Courts tab below is the one that
  // narrows to live venues, because that picker is about where to add courts
  // next rather than what already exists.
  const venuesWithCourts = VENUES.filter(v => courts.some((c: any) => c.venue_slug === v.slug))
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
  const activeWeek = weekFor(venueSettings, activeVenue)
  // Times offered when blocking a court: the club's own hours, hour by hour.
  const blockBounds = weekBounds(activeWeek)
  const blockSlots = generateTimeSlots(blockBounds.firstHour, Math.min(blockBounds.lastHour, 24), 60)
  const venueCourtIds = new Set(venueCourts.map(c => c.id))

  const bookingsForVenue = bookings.filter((b: any) => venueCourtIds.has(b.court_id))
  // The four stat cards describe the club on screen, not every club this owner can see.
  const membersForVenue = members.filter((m: any) => m.home_venue_slug === activeVenue)
  const todayBookings = bookingsForVenue.filter(b => b.date === today && b.status !== 'cancelled')
  const memberCount = membersForVenue.filter(m => (m as any).membership_tier !== 'casual').length

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

  const lastWeekBookings = bookingsForVenue.filter(b => b.date === sevenDaysAgo && b.status !== 'cancelled')
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
  const memberCountAsOf7DaysAgo = membersForVenue.filter(m => (m as any).membership_tier !== 'casual' && (m as any).created_at?.slice(0, 10) <= sevenDaysAgo).length
  const membersTrend = pctChange(memberCount, memberCountAsOf7DaysAgo)

  // Sparkline series for the stat cards -- same underlying figures as the
  // trend badges above, just spread across the trailing 7 days instead of
  // collapsed to a single day-over-day comparison.
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today + 'T00:00:00')
    d.setDate(d.getDate() - (6 - i))
    return localDateStr(d)
  })
  const bookingsSpark = last7Days.map(d => bookingsForVenue.filter(b => b.date === d && b.status !== 'cancelled').length)
  const playersSpark = last7Days.map(d => {
    const confirmed = bookingsForVenue.filter(b => b.date === d && b.status === 'confirmed')
    return new Set(confirmed.map((b: any) => b.user_id).filter(Boolean)).size
  })
  const revenueSpark = last7Days.map(d => {
    const confirmed = bookingsForVenue.filter(b => b.date === d && b.status === 'confirmed')
    return sumByCurrency(confirmed, b => currencyForVenueSlug(b.courts?.venue_slug), b => b.price_nzd).reduce((s, r) => s + r.amount, 0)
  })
  const membersSpark = last7Days.map(d => membersForVenue.filter(m => (m as any).membership_tier !== 'casual' && (m as any).created_at?.slice(0, 10) <= d).length)
  const visibleBookings = bookingsForVenue
    .filter(b => bookingsView === 'cancelled' ? b.status === 'cancelled' : b.status !== 'cancelled' && (bookingsView === 'past' ? b.date < today : b.date >= today))
    // Upcoming runs oldest to newest; Past and Cancelled show the latest first, with each day still in time order.
    .sort((a, b) => (a.date === b.date ? a.start_time.localeCompare(b.start_time) : bookingsView === 'upcoming' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)))
  const bookingDays: { date: string; rows: typeof visibleBookings }[] = []
  for (const b of visibleBookings) { const last = bookingDays[bookingDays.length - 1]; if (last && last.date === b.date) last.rows.push(b); else bookingDays.push({ date: b.date, rows: [b] }) }

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
  // The dates the board is actually showing. The summary strip and the
  // overview donut used to ignore this entirely: both were pinned to a window
  // measured from today, so paging the calendar to next month left every
  // figure underneath describing this week. What is summarised should be what
  // is on screen.
  const boardRange = (() => {
    const base = new Date(boardDate + 'T00:00:00')
    if (viewMode === 'day') {
      return { from: boardDate, to: boardDate, label: 'This day', spanDays: 1 }
    }
    if (viewMode === 'week') {
      const monday = new Date(base)
      monday.setDate(base.getDate() - ((base.getDay() + 6) % 7))
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      return { from: localDateStr(monday), to: localDateStr(sunday), label: 'This week', spanDays: 7 }
    }
    const first = new Date(base.getFullYear(), base.getMonth(), 1)
    const last = new Date(base.getFullYear(), base.getMonth() + 1, 0)
    return { from: localDateStr(first), to: localDateStr(last), label: 'This month', spanDays: last.getDate() }
  })()

  // The equally long stretch immediately before it, so the trend compares like
  // with like whatever the view.
  const prevRange = (() => {
    const from = new Date(boardRange.from + 'T00:00:00')
    const prevTo = new Date(from); prevTo.setDate(from.getDate() - 1)
    const prevFrom = new Date(prevTo); prevFrom.setDate(prevTo.getDate() - (boardRange.spanDays - 1))
    return { from: localDateStr(prevFrom), to: localDateStr(prevTo) }
  })()

  const publicBookingIdSet = new Set(publicBookingIds)
  const todayVenueBookings = bookingsForVenue.filter((b: any) => b.date >= boardRange.from && b.date <= boardRange.to && b.status !== 'cancelled')
  const todayCounts = {
    blocked: todayVenueBookings.filter(b => b.status === 'blocked').length,
    openPlay: todayVenueBookings.filter(b => b.status !== 'blocked' && publicBookingIdSet.has(b.id)).length,
    regular: todayVenueBookings.filter(b => b.status !== 'blocked' && !publicBookingIdSet.has(b.id)).length,
  }

  const inRange = (b: any, r: { from: string; to: string }) => b.date >= r.from && b.date <= r.to
  const thisWeekVenueBookings = bookingsForVenue.filter((b: any) => inRange(b, boardRange) && b.status === 'confirmed')
  const prevWeekVenueBookings = bookingsForVenue.filter((b: any) => inRange(b, prevRange) && b.status === 'confirmed')
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

  // The Reports tab's rows: this club's bookings, in the club's own currency, with the member's plan named.
  const reportRows: ReportRow[] = reportBookings.filter((b: any) => venueCourtIds.has(b.court_id)).map((b: any) => ({
    id: b.id, date: b.date, start_time: b.start_time ?? '', status: b.status, amount: Number(b.price_nzd) || 0,
    payment_method: b.payment_method, stripe_payment_id: b.stripe_payment_id ?? null, created_at: b.created_at ?? null,
    court_name: b.courts?.name ?? 'Court', end_time: b.end_time ?? '', duration_minutes: b.duration_minutes ?? undefined, member_email: b.profiles?.email ?? null,
    member_id: b.user_id ?? null, member_name: b.profiles?.full_name ?? '—',
    plan: b.profiles?.membership_tier ? planOf(effectivePlans(plans, activeVenue), b.profiles.membership_tier).name : '',
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
    if (!confirm('Cancel this booking? If it was paid, the member will be refunded in full, because the club is cancelling.')) return
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
    // A staff cancel refunds everyone in full, so say how many cards were
    // credited -- the club is paying it out and should see the count.
    const othersRefunded = data.splitsRefunded > 0
      ? ` ${data.splitsRefunded} other ${data.splitsRefunded === 1 ? 'player' : 'players'} refunded in full.`
      : ''
    const message = data.refundFailed
      ? 'Booking cancelled, but the refund could not be processed automatically — check Stripe.'
      : !data.isPaid
      ? 'Booking cancelled.' + othersRefunded
      : data.creditsRefunded > 0
      ? 'Booking cancelled. 1 session credit refunded.' + othersRefunded
      : data.creditAmount > 0
      ? `Booking cancelled. ${formatPrice(data.creditAmount, currency)} credit added for the member.${othersRefunded}`
      : 'Booking cancelled. Full refund issued to the member\'s card.' + othersRefunded
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

  // Today's numbers for the club on screen, on the two tabs about today. They sit under the page heading, like everything else.
  const statCards = (tab === 'board' || tab === 'bookings') ? <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
    {[
      { label: "Today's bookings", value: todayBookings.length, color: 'var(--brand-primary-text)', trend: bookingsTrend, trendLabel: 'vs same day last week', spark: bookingsSpark },
      { label: 'Players today',    value: playersToday, color: 'var(--text-primary)', trend: playersTrend, trendLabel: 'vs same day last week', spark: playersSpark },
      { label: 'Revenue today',    value: formatMultiCurrency(revenueTodayByCurrency), color: 'var(--brand-primary-text)', trend: revenueTrend, trendLabel: 'vs same day last week', spark: revenueSpark },
      { label: 'Paying members',   value: memberCount, color: 'var(--brand-accent)', trend: membersTrend, trendLabel: 'vs 7 days ago', spark: membersSpark },
    ].filter(c => canSeeMoney || c.label !== 'Revenue today').map(({ label, value, trend, trendLabel, spark }) => {
      // The four numbers wear the plan-tile colours: blue, green, gold, and a quiet grey for members.
      const fill = label === "Today's bookings" ? 'linear-gradient(160deg,#2c5fc4,#1d3f8d)' : label === 'Players today' ? 'linear-gradient(160deg,#2c5fc4,#1d3f8d)' : null
      const ink = fill ? '#ffffff' : 'var(--text-primary)'
      const sub = fill ? 'rgba(255,255,255,0.85)' : 'var(--text-subtle)'
      return (
        <div key={label} className="rounded-[20px] p-4 flex items-center justify-between gap-3"
          style={fill ? { background: fill, color: '#ffffff' } : { background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div className="min-w-0">
            <div className="text-xs font-bold mb-1.5" style={{ color: sub }}>{label}</div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <div className="text-[26px] sm:text-[28px] leading-none font-extrabold" style={{ color: ink, letterSpacing: '-0.02em' }}>{value}</div>
              {trend !== null && (() => {
                // Revenue is money: more is a green up arrow, less a red down arrow. The other three are counts, so they stay blue.
                const ch = label === 'Revenue today' ? moneyChange(trend) : countChange(trend)
                return ch
                  ? <MoneyBubble kind={ch.kind} size={11} testId={`stat-trend-${label === 'Revenue today' ? 'revenue' : 'count'}`}>{ch.arrow} {ch.text}</MoneyBubble>
                  : <span className="text-[11px] font-extrabold" style={{ color: sub }}>no change</span>
              })()}
            </div>
            <div className="text-[10.5px] mt-1.5" style={{ color: sub }}>{trendLabel}</div>
          </div>
          <Sparkline data={spark} color={fill ? '#ffffff' : 'var(--label-blue)'} />
        </div>
      )
    })}
  </div> : null

  return (
    <div className="flex gap-6">
      <AdminSidebar tab={tab} setTab={setTab} canSeeMoney={canSeeMoney} venueName={heroVenue?.name ?? 'Your club'} venueRegion={heroVenue?.region ?? ''} staffName={staffName} />
      <div className="flex-1 min-w-0">
      {/* No tab row on a phone: the bottom bar (and its More menu) opens every tab, so a second row only repeated it. md+ uses the sidebar. */}
      {/* Venue selector - shared across Board / Bookings / Courts */}
      {((tab === 'board' || tab === 'bookings' || tab === 'analytics' || tab === 'reports') && venuesWithCourts.length > 0) || (tab === 'courts' && courtTabVenues.length > 0) ? (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 min-h-[37px]">
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
        </div>
      ) : null}

{/* Members and Xero are not about one club's courts, but they open the same way as every other tab: a line saying whose they are. */}
      {(tab === 'members' || tab === 'xero') && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 min-h-[37px]">
          <div className="text-sm font-medium px-1" style={{ color: 'var(--text-primary)' }}>
            {managedVenueSlug ? `${getVenue(managedVenueSlug).name} — ${getVenue(managedVenueSlug).region}` : managedCountry ? `All ${managedCountry} clubs` : 'All clubs'}
          </div>
        </div>
      )}

{/* Board tab */}
      {tab === 'board' && (
        <div className="flex flex-col gap-4">
          <BoardView stats={statCards} canSeeMoney={canSeeMoney} today={today} setupHref={canSeeMoney && activeVenue ? `/admin/setup?venue=${encodeURIComponent(activeVenue)}` : null} week={activeWeek} bookings={bookings} venueCourts={venueCourts} boardDate={boardDate} setBoardDate={setBoardDate} viewMode={viewMode} setViewMode={setViewMode} publicBookingIds={publicBookingIds} members={members} />
          <BoardFooterStrip
            rangeLabel={boardRange.label}
            thisWeekCount={thisWeekVenueBookings.length}
            thisWeekTrend={thisWeekTrend}
            peakTime={peakTime}
            mostPopularCourtName={mostPopularCourtName}
            avgDurationLabel={avgDurationLabel}
          />
          <BoardRightRail
            overviewLabel={viewMode === 'day' ? "Today's bookings" : viewMode === 'week' ? "This week\u2019s bookings" : "This month\u2019s bookings"}
            todayCounts={todayCounts}
            upcomingBookings={upcomingBookings}
            onBlockCourt={() => setShowBlock(true)}
            onAddCourt={openAddCourt}
          />
          {activeVenue && <RegularsSummaryCard venueSlug={activeVenue} bookings={bookingsForVenue as any} courtCount={venueCourts.length} />}
        </div>
      )}

      {tab === 'analytics' && canSeeMoney && activeVenue && (
        <ClubAnalytics
          rows={reportRows.map(r => ({ date: r.date, start_time: r.start_time, status: r.status, member_id: r.member_id }))}
          members={members as any}
          courtCount={venueCourts.length}
          venueSlug={activeVenue}
          week={activeWeek}
          offersOn={offers !== null}
          todayStr={today}
          upcomingBookings={upcomingBookings}
        >
          <MoneyDemand venueSlug={activeVenue} week={activeWeek} courts={venueCourts} bookings={bookingsForVenue as any} unpaidShares={unpaidShares}
            waitDemand={waitDemand ? (waitDemand[activeVenue] ?? { total: 0, bookedAfter: 0, slots: [] }) : null}
            offers={offers ? offers.filter(o => o.venue_slug === activeVenue) : null} />
        </ClubAnalytics>
      )}

      {tab === 'reports' && (<>
        <CardHeading as="h2" size="section" className="mb-4">Reports</CardHeading>
        <FinancialReports rows={reportRows} creditTransactions={creditTransactions} todayStr={today} venueSlug={activeVenue} runningCosts={runningCosts} />
      </>)}

      {/* Bookings tab */}
      {tab === 'bookings' && (<>
        <div className="flex items-start justify-between gap-3 mb-4">
          <CardHeading as="h2" size="section" className="">Bookings</CardHeading>
          <button className="btn btn-primary btn-sm md:hidden shrink-0" onClick={() => setShowBlock(true)}>🔒 Block a court</button>
        </div>
        {/* The four big tiles are for the PC; a phone goes straight to the bookings. */}
        {statCards && <div className="mb-6 hidden md:block">{statCards}</div>}
        {canSeeMoney && (() => {
          // This week at a glance (owners only): what was taken, what went back, and what is overdue.
          const w = weekMoney(bookingsForVenue as any, today)
          const overdue = activeVenue ? splitOverdueShares(unpaidShares, activeVenue, Date.now()).overdueTotal : 0
          const cur = currencyForVenueSlug(activeVenue)
          const m = (n: number) => formatPrice(n, cur).replace(/\.00$/, '')
          // On a phone only what has something in it shows; the PC always shows all three.
          const cell = (label: string, id: string, kind: 'gain' | 'loss' | 'none', text: string, alwaysOnPhone = false) => (
            <div key={id} className={alwaysOnPhone || kind !== 'none' ? undefined : 'hidden md:block'}><div className="text-[11px] font-extrabold uppercase mb-1.5" style={{ letterSpacing: '0.1em', color: 'var(--text-primary)' }}>{label}</div>
              <MoneyBubble kind={kind} size={15} testId={id}>{text}</MoneyBubble></div>
          )
          return (
            <div className="rounded-[20px] p-5 mb-4 flex flex-wrap gap-x-8 gap-y-3" data-testid="bookings-week" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              {cell('Taken this week', 'week-taken', w.taken > 0 ? 'gain' : 'none', w.taken > 0 ? `+${m(w.taken)}` : m(0), true)}
              {cell('Refunded this week', 'week-refunded', w.refunded > 0 ? 'loss' : 'none', w.refunded > 0 ? `\u2212${m(w.refunded)}` : m(0))}
              {cell('Overdue', 'week-overdue', overdue > 0 ? 'loss' : 'none', m(overdue))}
            </div>
          )
        })()}
        {/* Upcoming, Past or Cancelled: a white switch (the "Show past bookings" tick box is gone). */}
        <div className="flex w-full md:w-auto md:ml-auto md:justify-end mb-3" data-testid="bookings-view">
          <div className="flex w-full md:w-auto gap-1 rounded-full p-1" style={{ background: 'var(--bg-raised)' }} role="radiogroup" aria-label="Which bookings">
            {(['upcoming', 'past', 'cancelled'] as const).map(v => (
              <button key={v} type="button" role="radio" aria-checked={bookingsView === v} data-testid={`bookings-view-${v}`} data-on={bookingsView === v ? 'true' : undefined} onClick={() => setBookingsView(v)}
                className="wh-seg flex-1 md:flex-none px-5 py-2.5 rounded-full text-[13px] font-bold capitalize transition-all"
                style={{ color: bookingsView === v ? undefined : 'var(--text-primary)', opacity: bookingsView === v ? 1 : 0.8 }}>{v}</button>
            ))}
          </div>
        </div>
        {/* Phones: a roomy card per booking under its day, swipe left to cancel. md and up has the grouped list below. */}
        <div className="md:hidden">
          <BookingCards rows={visibleBookings as any} showMoney={canSeeMoney} currencyFor={currencyForVenueSlug} onCancel={cancelBooking} today={today}
            emptyText={`No ${bookingsView === 'upcoming' ? 'upcoming ' : bookingsView === 'cancelled' ? 'cancelled ' : 'past '}bookings for this venue.`} />
        </div>
        <div className="hidden md:block bd-card" data-testid="bookings-web">
          <table className="bk-table w-full text-sm">
            <thead className="sr-only"><tr>{['Court', 'Member', 'Time', 'Amount', 'Status', ''].map(h => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {bookingDays.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-primary)' }}>
                    No {bookingsView === 'upcoming' ? 'upcoming ' : bookingsView === 'cancelled' ? 'cancelled ' : 'past '}bookings for this venue.
                  </td>
                </tr>
              ) : bookingDays.map(g => (
                <Fragment key={g.date}>
                  <tr data-testid="booking-day" data-date={g.date}>
                    <td colSpan={6} className="bk-ghead">
                      <div className="flex items-center gap-3">
                        {g.date === today
                          ? <span data-testid="booking-day-today" className="inline-block text-sm font-extrabold rounded-xl px-4 py-1.5" style={{ background: 'var(--today-block-bg)', color: 'var(--today-block-fg)', boxShadow: 'var(--today-block-shadow)' }}>Today</span>
                          : <span className="text-sm font-extrabold" style={{ color: 'var(--text-primary)' }}>{formatDate(g.date)}</span>}
                        {g.date === today && <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{formatDate(g.date)}</span>}
                        <span className="flex-1" />
                        <StatusDots kinds={g.rows.map(b => (b.status === 'confirmed' || b.status === 'completed' ? 'gain' : b.status === 'pending' ? 'wait' : b.status === 'cancelled' ? 'loss' : 'none') as MoneyKind)} max={12} />
                        <button type="button" data-testid="booking-day-board" className="bd-more" onClick={() => { setBoardDate(g.date); setViewMode('day'); setTab('board') }}>View on Board</button>
                        <MoneyBubble kind="wait" size={11.5} testId="booking-day-count">{g.rows.length} {g.rows.length === 1 ? 'booking' : 'bookings'}</MoneyBubble>
                      </div>
                    </td>
                  </tr>
                  {g.rows.map(b => {
                    const initials = String(b.profiles?.full_name ?? '?').split(' ').filter(Boolean).slice(0, 2).map((x: string) => x[0]).join('').toUpperCase()
                    const dot = b.status === 'confirmed' || b.status === 'completed' ? MONEY_HEX.gain : b.status === 'pending' ? MONEY_HEX.wait : b.status === 'cancelled' ? MONEY_HEX.loss : MONEY_HEX.none
                    return (
                      <tr key={b.id} className="bk-row" data-testid="booking-row" data-row-id={b.id} data-today={g.date === today ? 'true' : undefined}>
                        <td style={{ width: 70 }}><CourtTile name={b.courts?.name ?? ''} plain /></td>
                        <td>
                          <span className="flex items-center gap-3 min-w-0">
                            <span className="w-[34px] h-[34px] rounded-full inline-flex items-center justify-center text-[13px] font-extrabold text-white shrink-0" style={{ background: 'linear-gradient(160deg,#2c5fc4,#1d3f8d)' }}>{initials}</span>
                            <span className="text-[15.5px] font-extrabold whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{b.profiles?.full_name ?? '—'}</span>
                          </span>
                        </td>
                        <td className="text-[15px] font-extrabold whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{fmtClock(b.start_time)}</td>
                        <td>
                          {canSeeMoney && b.price_nzd > 0
                            ? <MoneyBubble kind={bookingKind(b.status)} size={13} testId="booking-amount" strike={b.status === 'cancelled'}>{formatPrice(b.price_nzd, currencyForVenueSlug(b.courts?.venue_slug))}</MoneyBubble>
                            : <span style={{ color: 'var(--text-muted)', fontWeight: 800 }}>—</span>}
                        </td>
                        <td>
                          <span className="inline-flex items-center gap-2 text-[13px] font-extrabold" style={{ color: 'var(--text-primary)' }}>
                            <i style={{ width: 9, height: 9, borderRadius: 99, background: dot, display: 'inline-block' }} />
                            <span className="capitalize" data-testid="booking-status">{b.status}</span>
                          </span>
                        </td>
                        <td className="text-right">
                          {b.status !== 'cancelled' && b.status !== 'blocked' && (
                            <button className="btn btn-danger btn-sm" onClick={() => cancelBooking(b.id)}>
                              Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </>)}

      {/* Members tab */}
      {tab === 'members' && (
        <div>
          <CardHeading as="h2" size="section" className="mb-4">Members</CardHeading>
          {memberTierFilter !== 'all' && (
            <div className="flex flex-wrap items-center gap-3 mb-4" data-testid="plan-filter-tag">
              {initialPlan && (managedVenueSlug ?? initialVenue) && (
                <Link href={`/admin/setup?venue=${encodeURIComponent((managedVenueSlug ?? initialVenue) as string)}`} className="text-[13px] font-extrabold" style={{ color: 'var(--brand-primary-text)' }}>‹ Back to Club settings</Link>
              )}
              <span className="inline-flex items-center gap-2 rounded-full pl-4 pr-2 py-2 text-[13px] font-black" style={{ background: 'var(--brand-primary)', color: 'var(--brand-primary-on)' }}>
                Showing the {tierLabel(memberTierFilter)} plan · {visibleMembers.length} {visibleMembers.length === 1 ? 'member' : 'members'}
                <button type="button" onClick={() => setMemberTierFilter('all')} aria-label="Show everyone" className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[11px]" style={{ background: 'rgba(255,255,255,0.25)' }}>✕</button>
              </span>
              <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>Tap ✕ to see everyone</span>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <input type="text" className="input text-sm w-auto flex-1 min-w-[180px]" placeholder="Search by name or member #…"
              value={memberSearch} onChange={e => setMemberSearch(e.target.value)} />
            <select className="input text-sm w-auto" value={memberTierFilter} onChange={e => setMemberTierFilter(e.target.value)}>
              <option value="all">All memberships</option>
              {memberTiers.map(t => <option key={t} value={t}>{tierLabel(t)}</option>)}
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
                    <th key={h} className={`text-left px-4 py-3 text-xs font-medium ${h === '#' || h === 'Role' || h === 'Joined' ? 'hidden sm:table-cell' : ''}`}
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
                    <td className="px-4 py-3 text-xs hidden sm:table-cell" style={{ color: 'var(--text-subtle)' }}>
                      {(m as any).member_number != null ? `#${(m as any).member_number}` : '—'}
                    </td>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                      {(m as any).nickname ?? m.full_name ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="badge badge-member">{planOf(effectivePlans(plans, (m as any).home_venue_slug ?? null), m.membership_tier).name}</span>
                      {plans && canSeeMoney && (m as any).home_venue_slug && m.role === 'member' && (
                        <button type="button" onClick={() => setPlanFor({ id: m.id, name: (m as any).nickname ?? m.full_name ?? 'Member', tier: m.membership_tier, home: (m as any).home_venue_slug })}
                          className="ml-2 text-xs font-bold underline" style={{ color: 'var(--link-change)' }}>Change</button>
                      )}
                      {plans && canSeeMoney && !(m as any).home_venue_slug && m.role === 'member' && (
                        <span className="ml-2 text-xs" style={{ color: 'var(--text-subtle)' }}>no home club yet</span>
                      )}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--brand-primary-text)' }}>{m.credits ?? 0}</td>
                    <td className="px-4 py-3 capitalize hidden sm:table-cell" style={{ color: 'var(--text-muted)' }}>{m.role}</td>
                    <td className="px-4 py-3 text-xs hidden sm:table-cell" style={{ color: 'var(--text-subtle)' }}>
                      {(m as any).created_at ? formatDateWithYear((m as any).created_at) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {planFor && plans && (
        <MemberPlanDialog member={planFor} plans={effectivePlans(plans, planFor.home)} onClose={() => setPlanFor(null)} />
      )}

      {/* Courts tab */}
      {tab === 'courts' && (<>
        <div className="flex items-start justify-between gap-3 mb-4">
          <CardHeading as="h2" size="section" className="">Courts</CardHeading>
          {venueCourts.length > 0 && (
            <button className="btn btn-primary btn-sm shrink-0" onClick={openAddCourt}>+ Add court</button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {venueCourts.length === 0 ? (
            <div className="rounded-xl text-center py-12 text-sm sm:col-span-2" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>No courts yet for this venue.</div>
              {canSeeMoney && activeVenue ? (
                <>
                  <p className="mt-1 text-xs">Club settings sets up your hours, courts and prices together, so players can start booking.</p>
                  <div className="mt-4 mx-auto max-w-xs">
                    <Link href={`/admin/setup?venue=${encodeURIComponent(activeVenue)}`} className="btn-main btn-main-lime" data-testid="courts-go-setup">Set up this club</Link>
                  </div>
                  <button type="button" className="mt-3 text-xs font-bold" style={{ color: 'var(--label-blue)' }} onClick={openAddCourt}>or add a single court here</button>
                </>
              ) : (
                <div className="mt-3 mx-auto max-w-xs"><button className="btn-main" onClick={openAddCourt}>+ Add the first court</button></div>
              )}
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
      </>)}

      {tab === 'xero' && (<>
        <CardHeading as="h2" size="section" className="mb-4">Xero</CardHeading>
        <XeroSettingsPanel />
      </>)}

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
                    {blockSlots.map(t => <option key={t} value={t}>{fmtClock(t)}</option>)}
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
  week, bookings, venueCourts, viewMode, setViewMode, boardDate, setBoardDate, publicBookingIds, members, today, setupHref = null, stats = null, canSeeMoney = false,
}: {
  stats?: React.ReactNode
  canSeeMoney?: boolean
  week: WeekHours
  bookings: any[]
  venueCourts: Court[]
  viewMode: 'day' | 'week' | 'month'
  setViewMode: (m: 'day' | 'week' | 'month') => void
  boardDate: string
  setBoardDate: (d: string) => void
  publicBookingIds: string[]
  members: Profile[]
  today: string
  // Where an owner finishes setting the club up (null for front desk).
  setupHref?: string | null
}) {
  const router = useRouter()
  const [dayDetail, setDayDetail] = useState<string | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverDate, setDragOverDate] = useState<string | null>(null)
  const [dragOverCell, setDragOverCell] = useState<string | null>(null)
  const [moving, setMoving] = useState(false)
  const [dayLayout, setDayLayout] = useState<'grid' | 'list'>('grid')
  // The hour it is now, for the lime marker on today's grid. Set in the browser only, so the server and the page agree on first paint.
  const [nowHour, setNowHour] = useState<number | null>(null)
  const [nowMin, setNowMin] = useState(0)
  useEffect(() => { const tick = () => { const d = new Date(); setNowHour(d.getHours()); setNowMin(d.getMinutes()) }; tick(); const t = setInterval(tick, 60000); return () => clearInterval(t) }, [])
  // Where the white "now" line sits on the web day grid, in pixels from the top of the grid card. Measured from the hour's own row.
  const dayCardRef = useRef<HTMLDivElement | null>(null)
  const [nowTop, setNowTop] = useState<number | null>(null)
  const [rosterBooking, setRosterBooking] = useState<{ id: string; title: string; subtitle: string } | null>(null)
  const publicBookingIdSet = new Set(publicBookingIds)
  const venueCurrency = currencyForVenueSlug(venueCourts[0]?.venue_slug)

  // A single place to decide how a booking cell looks: a staff-blocked slot
  // reads as unavailable rather than a real booking (and its "booker" is
  // actually whichever staff member blocked it, not a real customer, so a
  // name there is more confusing than useful); a public find-a-game match
  // gets its own colour so staff can spot an open-to-anyone slot at a
  // glance, distinct from an ordinary private booking.
  // A week of someone's weekly regular is marked on the Board.
  const regularMark = (b: any) => (b.regular_id ? '🔁 ' : '')
  const cellAppearance = (b: any): { background: string; color: string; label: string } => {
    if (b.status === 'blocked') {
      return { background: 'var(--brand-crimson-muted)', color: 'var(--brand-crimson)', label: 'Blocked' }
    }
    if (publicBookingIdSet.has(b.id)) {
      return { background: 'linear-gradient(160deg,#1f9a5f,#0f5c38)', color: '#ffffff', label: regularMark(b) + (b.profiles?.full_name?.split(' ')[0] ?? 'Open play') }
    }
    return { background: 'linear-gradient(160deg,#2c5fc4,#1d3f8d)', color: '#ffffff', label: regularMark(b) + (b.profiles?.full_name?.split(' ')[0] ?? '—') }
  }

  // The web Board shows every booking as a status bubble: paid green, pending blue, open play grey, blocked red.
  const boardKind = (b: any): MoneyKind => b.status === 'blocked' ? 'loss' : publicBookingIdSet.has(b.id) ? 'none' : bookingKind(b.status)

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

  // Was a local reimplementation of formatDate, character for character.
  const dayLabel = formatDate

  // The arrows step by whatever the board is showing: a day, a week or a month.
  const shiftDate = (dir: 1 | -1) => {
    const base = new Date(boardDate + 'T00:00:00')
    if (viewMode === 'month') setBoardDate(localDateStr(new Date(base.getFullYear(), base.getMonth() + dir, 1)))
    else { base.setDate(base.getDate() + dir * (viewMode === 'day' ? 1 : 7)); setBoardDate(localDateStr(base)) }
  }
  const unitName = viewMode === 'day' ? 'day' : viewMode === 'week' ? 'week' : 'month'
  // The web day grid's white "now" line: from the top of the current hour's row, down by the minutes gone.
  useEffect(() => {
    const card = dayCardRef.current
    const cell = viewMode === 'day' && dayLayout === 'grid' && boardDate === today ? card?.querySelector('td[data-now="true"]') as HTMLElement | null : null
    if (!card || !cell) { setNowTop(null); return }
    const c = card.getBoundingClientRect(), r = cell.getBoundingClientRect()
    setNowTop(r.top - c.top + card.scrollTop - card.clientTop + r.height * (nowMin / 60))
  }, [viewMode, dayLayout, boardDate, today, nowHour, nowMin, bookings.length, venueCourts.length, rosterBooking])

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

  // Rows run from the club's earliest opening to its latest closing (07:00 to
  // 22:00 until it sets hours), stretched to include any booking that falls
  // outside them so nothing ever disappears off the grid.
  const { firstHour, lastHour } = weekBounds(week)
  let rowFrom = firstHour, rowTo = lastHour
  for (const b of bookings) {
    if (b.status === 'cancelled' || !venueCourts.some((c: any) => c.id === b.court_id)) continue
    rowFrom = Math.min(rowFrom, parseInt(b.start_time.slice(0, 2), 10))
    rowTo = Math.max(rowTo, Math.ceil((parseInt(b.end_time.slice(0, 2), 10) * 60 + parseInt(b.end_time.slice(3, 5), 10)) / 60))
  }
  const TIME_ROWS = Array.from({ length: Math.min(rowTo, 24) - rowFrom + 1 }, (_, i) => String(rowFrom + i).padStart(2, '0') + ':00')
  const weekDates = getWeekDates()
  const courtColors = ['var(--brand-primary)', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4', '#10B981']
  const colorMap: Record<string, string> = {}
  venueCourts.forEach((court: any, i: number) => { colorMap[court.id] = courtColors[i % courtColors.length] })

  // Every Day and Week cell is this tall whether or not it holds a booking,
  // matching the Month view's boxes. Fixing it also keeps a court row from
  // growing just because one of its slots filled up, which would shift every
  // row below it as you page through dates.
  const MONTH_CELL_HEIGHT = 76
  // Day view runs the other way round -- courts across, hours down -- so its
  // rows don't need Month's height. Sixteen of them at 76px made a 1200px
  // table; this keeps the whole trading day on one screen while giving each
  // cell several times the width it had when the hours were columns.
  const DAY_ROW_HEIGHT = 50
  // A booking's block is exactly as long as the booking: an hour of Day view is one row plus the 8px gap between rows.
  // A 3:00 to 4:30 booking ends halfway down the 4 pm row, and one that starts at :30 starts halfway down its row.
  const HOUR_PX = DAY_ROW_HEIGHT + 8
  const dayBlockSize = (b: any, span: number) => {
    const startMin = parseInt(String(b.start_time ?? '').slice(3, 5), 10) || 0
    const mins = Number(b.duration_minutes) || span * 60
    return { height: Math.max(26, (mins / 60) * HOUR_PX - 8), marginTop: (startMin / 60) * HOUR_PX }
  }

  const shortDay = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })
  const atNow = viewMode === 'day' ? boardDate === today : viewMode === 'week' ? weekDates.includes(today) : boardDate.slice(0, 7) === today.slice(0, 7)
  const nowLabel = viewMode === 'day' ? 'Today' : viewMode === 'week' ? 'This week' : 'This month'
  const title = viewMode === 'month'
    ? new Date(boardDate + 'T00:00:00').toLocaleDateString('en-NZ', { month: 'long', year: 'numeric' })
    : viewMode === 'week'
    ? dayLabel(weekDates[0]) + ' – ' + dayLabel(weekDates[6])
    : dayLabel(boardDate)

  return (
    <div className="space-y-4">
      {/* Said "Today's Bookings" over a month of October 2026. It now names
          whatever the view is actually showing. */}
      <CardHeading as="h2" size="section" className="">
        Board
      </CardHeading>
      {stats && <div className="pb-2">{stats}</div>}
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{viewMode === 'day' ? "Today's bookings" : viewMode === 'week' ? 'This week\u2019s bookings' : 'This month\u2019s bookings'}</p>
      {/* One date control for Day, Week and Month, in the same place in all three: both arrows
          together on the left, stepping by whatever is on screen (a day, a week, a month), with
          the date beside them and a way back to now. Grid / List only applies to Day, so it sits
          beside the day strip rather than up here. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 w-full sm:w-auto" data-testid="board-date-control">
          {(['prev', 'next'] as const).map(k => (
            <button key={k} type="button" onClick={() => shiftDate(k === 'prev' ? -1 : 1)} data-testid={`board-${k}`}
              aria-label={`${k === 'prev' ? 'Previous' : 'Next'} ${unitName}`} title={`${k === 'prev' ? 'Previous' : 'Next'} ${unitName}`}
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-base"
              style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              {k === 'prev' ? '‹' : '›'}
            </button>
          ))}
          <span className="text-base font-semibold ml-1 min-w-0 flex-1 sm:flex-none sm:truncate" data-testid="board-title" style={{ color: 'var(--text-primary)' }}>
            {viewMode === 'week' ? (<><span className="sm:hidden">{shortDay(weekDates[0])} – {shortDay(weekDates[6])}</span><span className="hidden sm:inline">{title}</span></>) : title}
          </span>
          {atNow
            ? <span className="text-xs font-bold rounded-full px-3 py-1.5 shrink-0" data-testid="board-now" style={{ background: 'var(--brand-primary-muted)', color: 'var(--brand-primary-text)', border: '1px solid var(--brand-primary)' }}>{nowLabel}</span>
            : <button type="button" onClick={() => setBoardDate(today)} data-testid="board-today" className="text-xs font-bold rounded-full px-3 py-1.5 shrink-0"
                style={{ background: 'var(--bg-raised)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>{nowLabel}</button>}
        </div>
        <div className="flex gap-1 rounded-lg p-1 w-full sm:w-auto" style={{ background: 'var(--bg-raised)' }}>
          {(['day', 'week', 'month'] as const).map(m => (
            <button key={m} onClick={() => setViewMode(m)} data-on={viewMode === m ? 'true' : undefined}
              className="bd-seg flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium capitalize transition-all"
              style={viewMode === m ? { background: 'var(--today-block-bg)', color: 'var(--today-block-fg)', boxShadow: 'var(--today-block-shadow)' } : { background: 'transparent', color: 'var(--text-muted)' }}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {viewMode === 'day' && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Two days behind the selected one, four ahead, so yesterday is one tap. A fixed width
              keeps every pill the same size and the row from reflowing as the dates change. */}
          <div className="flex gap-2 flex-wrap">
            {Array.from({ length: 7 }, (_, i) => {
              const d = new Date(boardDate + 'T00:00:00')
              d.setDate(d.getDate() + i - 2)
              return localDateStr(d)
            }).map(d => (
              <button key={d} onClick={() => setBoardDate(d)} data-on={d === boardDate ? 'true' : undefined}
                className="bd-seg py-2 rounded-lg text-sm font-medium whitespace-nowrap text-center shrink-0 transition-colors"
                style={{
                  width: 78,
                  background: d === boardDate ? 'var(--brand-primary)' : 'var(--bg-raised)',
                  color: d === boardDate ? 'var(--brand-primary-on)' : (d === today ? 'var(--brand-primary-text)' : 'var(--text-muted)'),
                  border: `1px solid ${d === boardDate ? 'var(--brand-primary)' : 'var(--border)'}`,
                }}>
                {formatDateCompact(d)}
              </button>
            ))}
          </div>
          <div className="flex gap-1 rounded-lg p-1 w-full sm:w-auto" style={{ background: 'var(--bg-raised)' }}>
            {(['grid', 'list'] as const).map(m => (
              <button key={m} onClick={() => setDayLayout(m)} data-on={dayLayout === m ? 'true' : undefined}
                className="bd-seg flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium capitalize transition-all"
                style={{ background: dayLayout === m ? 'var(--brand-primary)' : 'transparent', color: dayLayout === m ? 'var(--brand-primary-on)' : 'var(--text-muted)' }}>
                {m}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* The panel used to float over the dashboard, which is why it
          clashed with whatever was underneath. Docked here instead: the
          board and the panel are siblings in a row, so the grid narrows to
          make room and nothing is covered. On a phone there is no room to
          dock, so it stays a sheet (rendered below this row). */}
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
        {venueCourts.length === 0 ? (
          <div className="rounded-xl text-center py-12 text-sm" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            No courts yet for this venue.{' '}
            {setupHref
              ? <Link href={setupHref} className="font-bold underline" style={{ color: 'var(--brand-primary-text)' }}>Set up your club</Link>
              : 'Ask the club owner to finish setting up the club.'}
          </div>
        ) : viewMode === 'month' ? (
          <div>
            <div className="bd-mgrid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                <div key={d} className="bd-mhead" style={{ padding: '6px 4px', textAlign: 'center', fontSize: 11, color: 'var(--text-primary)', fontWeight: 700, letterSpacing: 0.3, background: 'var(--bg-raised)', borderBottom: '1px solid var(--border)' }}>{d}</div>
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
                  // A busy day (more than two) is summarised on the web: a count, a dot per booking, the first and last time, and a way into that day.
                  const busy = dayBookings.length > 2
                  const startTimes = dayBookings.map((b: any) => b.start_time as string).sort()
                  const isPast = date < today
                  const isDragOver = dragOverDate === date && !isPast
                  return (
                    <div key={idx} className="bd-mcell" data-today={isToday ? 'true' : undefined} data-over={isDragOver ? 'true' : undefined} onClick={() => dayBookings.length > 0 && setDayDetail(date)}
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
                      style={{ borderRight: (idx + 1) % 7 === 0 ? 'none' : '1px solid var(--border)', borderBottom: '1px solid var(--border)', minHeight: 76, padding: 4, background: isDragOver ? 'var(--brand-primary-muted)' : 'var(--bg-surface)', boxShadow: isDragOver ? 'inset 0 0 0 2px var(--brand-primary)' : 'none', opacity: otherMonth ? 0.4 : 1, cursor: dayBookings.length > 0 ? 'pointer' : 'default', transition: 'background 0.1s' }}>
                      <div style={{ marginBottom: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}><span className={isToday ? 'bd-todaynum' : undefined} data-testid={isToday ? 'month-today' : undefined} style={{ display: 'inline-block', fontSize: 12, fontWeight: isToday ? 800 : 600, color: isToday ? '#ffffff' : 'var(--text-primary)', background: isToday ? 'var(--brand-primary)' : 'transparent', borderRadius: 99, padding: isToday ? '1px 7px' : 0 }}>{dayNum}</span>{busy && <span data-testid="month-busy-count" className="hidden md:inline-block money-bubble" style={{ ...moneyVars('wait'), whiteSpace: 'nowrap', fontSize: 10.5, fontWeight: 800, padding: '2px 9px', borderRadius: 99 }}>{dayBookings.length} bookings</span>}</div>
                      <div className={busy ? 'md:hidden' : undefined}>
                      {show.map((b: any) => {
                        const color = colorMap[b.court_id] ?? 'var(--brand-primary)'
                        return (
                          <div key={b.id} className="bd-chip"
                            draggable={!isPast && !moving}
                            onDragStart={e => {
                              e.stopPropagation()
                              e.dataTransfer.setData('text/booking-id', b.id)
                              e.dataTransfer.effectAllowed = 'move'
                              setDraggedId(b.id)
                            }}
                            onDragEnd={() => { setDraggedId(null); setDragOverDate(null) }}
                            title={!isPast ? 'Drag to another day to reschedule' : undefined}
                            style={{ ...moneyVars(boardKind(b)), fontSize: 11, fontWeight: 600, padding: '2px 5px', borderRadius: 3, marginBottom: 2, background: isPast ? 'rgba(170,170,170,0.3)' : color, color: isPast ? 'rgba(255,255,255,0.8)' : '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: isPast ? 'line-through' : 'none', cursor: isPast ? 'default' : 'grab', opacity: draggedId === b.id ? 0.4 : isToday ? 1 : isPast ? 0.4 : 0.55 }}>
                            {fmtClock(b.start_time)} · {b.profiles?.full_name?.split(' ')[0] ?? '?'}
                          </div>
                        )
                      })}
                      {extra > 0 && <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--brand-primary-text)', padding: '0 4px' }}>+{extra} more</div>}
                      </div>
                      {busy && (
                        <div className="hidden md:flex flex-col" data-testid="month-busy" style={{ gap: 8, marginTop: 8 }}>
                          <StatusDots kinds={dayBookings.map(boardKind)} />
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>{fmtClock(startTimes[0])} to {fmtClock(startTimes[startTimes.length - 1])}</div>
                          <button type="button" data-testid="month-open-day" className="bd-more self-start" onClick={e => { e.stopPropagation(); setBoardDate(date); setViewMode('day') }}>Open day</button>
                        </div>
                      )}
                    </div>
                  )
                })
              })()}
            </div>
            <BoardStatusLegend />
            <div className="flex md:hidden" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {venueCourts.map((court: any, i: number) => (
                <div key={court.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: 'var(--text-primary)', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 99, padding: '4px 11px' }}>
                  <div style={{ width: 9, height: 9, borderRadius: 99, background: courtColors[i % courtColors.length] }} />
                  {court.name}
                </div>
              ))}
            </div>
          </div>
        ) : viewMode === 'week' ? (
          <div>
            <div className="hidden md:block bd-card" data-testid="week-grid-web" style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <table className="bd-table w-full table-fixed text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="bd-th px-3 py-2 text-left whitespace-nowrap" style={{ width: 84, fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', background: 'var(--bg-raised)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>Court</th>
                    {weekDates.map(d => (
                      <th key={d} className="bd-th px-2 py-2 whitespace-nowrap text-center" style={{ fontSize: 12, letterSpacing: 0.2, color: 'var(--text-primary)', background: 'var(--bg-raised)', opacity: d === today ? 1 : d < today ? 0.55 : 0.8, fontWeight: d === today ? 800 : 700, borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}
                          data-today={d === today ? 'true' : undefined}>
                        {d === today
                          ? <span data-testid="today-date" style={{ display: 'inline-block', background: 'var(--today-block-bg)', color: 'var(--today-block-fg)', borderRadius: 14, padding: '7px 18px', boxShadow: 'var(--today-block-shadow)' }}>{formatDateCompact(d)}</span>
                          : <span style={{ display: 'inline-block', padding: '7px 0' }}>{formatDateCompact(d)}</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {venueCourts.map((court: any, rowIdx: number) => (
                    <tr key={court.id}>
                      <td className="px-3 font-medium whitespace-nowrap text-center" style={{ height: MONTH_CELL_HEIGHT, fontSize: 12, background: 'transparent', color: 'var(--text-primary)', borderBottom: 'none', borderRight: 'none' }}>
                        <CourtTile name={court.name} plain />
                      </td>
                      {weekDates.map((d, colIdx) => {
                        const dayBookings = bookings.filter((b: any) => b.date === d && b.court_id === court.id && b.status !== 'cancelled')
                        const show = dayBookings.slice(0, 2)
                        const extra = dayBookings.length - show.length
                        const busy = dayBookings.length > 2
                        return (
                          <td key={d} className="bd-td align-middle" data-today={d === today ? 'true' : undefined}
                            // Day and Month both let you drag a booking to a new
                            // slot; Week never did, so the one view that shows a
                            // whole week at a glance was the one you couldn't
                            // rearrange in. A week cell is a court and a day, so
                            // a drop moves both and keeps the time.
                            onDragOver={e => { if (d >= today) { e.preventDefault(); setDragOverCell(`${court.id}-${d}`) } }}
                            onDragLeave={() => setDragOverCell(prev => (prev === `${court.id}-${d}` ? null : prev))}
                            onDrop={e => {
                              e.preventDefault()
                              setDragOverCell(null)
                              const id = e.dataTransfer.getData('text/booking-id') || draggedId
                              setDraggedId(null)
                              if (!id || d < today) return
                              const dragged = bookings.find((bk: any) => bk.id === id)
                              if (dragged && dragged.date === d && dragged.court_id === court.id) return
                              moveBooking(id, { newDate: d, newCourtId: court.id })
                            }}
                            style={{
                            height: MONTH_CELL_HEIGHT,
                            padding: 8,
                            background: dragOverCell === `${court.id}-${d}` && d >= today
                              ? 'var(--brand-primary-muted)'
                              : 'var(--board-cell)',
                            borderRadius: 14,
                          }}>
                            {busy && (
                              <div data-testid="week-busy" className="flex flex-col" style={{ gap: 5 }}>
                                <span className="money-bubble self-start" style={{ ...moneyVars('wait'), fontSize: 10.5, fontWeight: 800, padding: '2px 9px', borderRadius: 99 }}>{dayBookings.length} bookings</span>
                                <StatusDots kinds={dayBookings.map(boardKind)} max={12} />
                                <button type="button" data-testid="week-open-day" className="bd-more self-start" onClick={() => { setBoardDate(d); setViewMode('day') }}>Open day</button>
                              </div>
                            )}
                            {!busy && show.map((b: any) => {
                              const appearance = cellAppearance(b)
                              return (
                                <div key={b.id} className="truncate money-bubble" data-kind={boardKind(b)}
                                  draggable={d >= today && !moving}
                                  onDragStart={e => {
                                    e.dataTransfer.setData('text/booking-id', b.id)
                                    e.dataTransfer.effectAllowed = 'move'
                                    setDraggedId(b.id)
                                  }}
                                  onDragEnd={() => { setDraggedId(null); setDragOverCell(null) }}
                                  style={{ ...moneyVars(boardKind(b)), fontSize: 11, fontWeight: 800, padding: '4px 8px', borderRadius: 99, marginBottom: 4, textAlign: 'center', letterSpacing: '-0.01em', cursor: b.status === 'blocked' ? 'default' : d >= today ? 'grab' : 'pointer', opacity: draggedId === b.id ? 0.4 : d === today ? 1 : d < today ? 0.4 : 0.55 }}
                                  title={b.status === 'blocked' ? undefined : 'Click to view players and payment status; drag to another day or court'}
                                  onClick={() => {
                                    if (b.status === 'blocked') return
                                    setRosterBooking({
                                      id: b.id,
                                      title: `${court.name} · ${fmtClockRange(b.start_time, b.end_time)}`,
                                      subtitle: `${formatDate(d)} · ${publicBookingIdSet.has(b.id) ? 'Open play' : 'Regular booking'}`,
                                    })
                                  }}>
                                  {fmtClock(b.start_time)} · {appearance.label}
                                </div>
                              )
                            })}
                            {!busy && extra > 0 && (
                              <div onClick={() => setDayDetail(d)} style={{ fontSize: 10, fontWeight: 700, color: 'var(--brand-primary-text)', padding: '0 4px', cursor: 'pointer' }}>
                                +{extra} more
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

            {/* Phones: courts across the top, the week's dates down the side. The
                desktop grid above has a column per day, which on a phone leaves
                each date about forty pixels and the labels run into each other.
                A club has a handful of courts but seven days, so the long
                direction goes down the page, where scrolling is natural. Tap a
                booking to see its players; "+N more" opens that day. */}
            <div className="md:hidden" data-testid="week-grid-phone" style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <table className="w-full table-fixed text-sm border-collapse">
                <thead>
                  <tr>
                    <th style={{ width: 62, background: 'var(--bg-raised)', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)' }} />
                    {venueCourts.map((court: any, idx: number) => (
                      <th key={court.id} className="px-1 py-2 text-center truncate" style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.2, color: 'var(--text-primary)', background: 'var(--bg-raised)', borderBottom: '1px solid var(--border)', borderRight: idx === venueCourts.length - 1 ? 'none' : '1px solid var(--border)' }}>
                        <CourtTile name={court.name} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weekDates.map((d, rowIdx) => {
                    const isToday = d === today
                    const last = rowIdx === weekDates.length - 1
                    return (
                      <tr key={d}>
                        <td className="px-2 align-top whitespace-nowrap" style={{ paddingTop: 8, fontSize: 11, fontWeight: 700, color: isToday ? 'var(--brand-primary-text)' : 'var(--text-primary)', background: isToday ? 'var(--brand-primary-muted)' : 'var(--bg-raised)', borderBottom: last ? 'none' : '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
                          {formatDateCompact(d)}
                        </td>
                        {venueCourts.map((court: any, colIdx: number) => {
                          const dayBookings = bookings
                            .filter((b: any) => b.date === d && b.court_id === court.id && b.status !== 'cancelled')
                            .sort((x: any, y: any) => x.start_time.localeCompare(y.start_time))
                          const show = dayBookings.slice(0, 3)
                          const extra = dayBookings.length - show.length
                          return (
                            <td key={court.id} className="align-top" style={{ minHeight: 56, height: 56, padding: 3, background: isToday ? 'var(--brand-primary-muted)' : 'var(--bg-surface)', borderBottom: last ? 'none' : '1px solid var(--border)', borderRight: colIdx === venueCourts.length - 1 ? 'none' : '1px solid var(--border)' }}>
                              {show.map((b: any) => {
                                const appearance = cellAppearance(b)
                                return (
                                  <div key={b.id} className="truncate"
                                    style={{ fontSize: 10, fontWeight: 600, padding: '3px 4px', borderRadius: 4, marginBottom: 2, background: appearance.background, color: appearance.color, cursor: b.status === 'blocked' ? 'default' : 'pointer' }}
                                    onClick={() => {
                                      if (b.status === 'blocked') return
                                      setRosterBooking({
                                        id: b.id,
                                        title: `${court.name} · ${fmtClockRange(b.start_time, b.end_time)}`,
                                        subtitle: `${formatDate(d)} · ${publicBookingIdSet.has(b.id) ? 'Open play' : 'Regular booking'}`,
                                      })
                                    }}>
                                    {fmtClock(b.start_time)} · {appearance.label}
                                  </div>
                                )
                              })}
                              {extra > 0 && (
                                <div onClick={() => setDayDetail(d)} style={{ fontSize: 10, fontWeight: 700, color: 'var(--brand-primary-text)', padding: '0 3px', cursor: 'pointer' }}>
                                  +{extra} more
                                </div>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <BoardCategoryLegend />
            <BoardStatusLegend />
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
                  <div key={b.id} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--border)', cursor: b.status === 'blocked' ? 'default' : 'pointer' }}
                    onClick={() => {
                      if (b.status === 'blocked') return
                      setRosterBooking({
                        id: b.id,
                        title: `${court?.name ?? 'Court'} · ${fmtClockRange(b.start_time, b.end_time)}`,
                        subtitle: `${formatDate(boardDate)} · ${publicBookingIdSet.has(b.id) ? 'Open play' : 'Regular booking'}`,
                      })
                    }}>
                    <div className="text-xs font-semibold shrink-0" style={{ color: 'var(--text-primary)', width: 64 }}>{fmtClock(b.start_time)}</div>
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
          <div>
            {(() => {
              // The day at a glance, on the web: how many bookings, what has been paid, what is waiting. Front desk sees the counts but never the money.
              const dayAll = bookings.filter((b: any) => b.date === boardDate && b.status !== 'cancelled' && venueCourts.some((c: any) => c.id === b.court_id))
              const real = dayAll.filter((b: any) => b.status !== 'blocked')
              const blockedN = dayAll.length - real.length
              const openN = real.filter((b: any) => publicBookingIdSet.has(b.id)).length
              const sumOf = (k: MoneyKind) => real.filter((b: any) => bookingKind(b.status) === k).reduce((a: number, b: any) => a + (b.price_nzd || 0), 0)
              const paid = sumOf('gain'), pending = sumOf('wait')
              return (
                <div className="hidden md:flex" data-testid="day-summary" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap', margin: '0 2px 12px' }}>
                  <MoneyBubble kind="wait" size={12} testId="day-summary-count">{real.length} {real.length === 1 ? 'booking' : 'bookings'}</MoneyBubble>
                  {canSeeMoney && <MoneyBubble kind="gain" size={12} testId="day-summary-paid">{formatPrice(paid, venueCurrency)} paid</MoneyBubble>}
                  {canSeeMoney && pending > 0 && <MoneyBubble kind="wait" size={12} testId="day-summary-pending">{formatPrice(pending, venueCurrency)} pending</MoneyBubble>}
                  {openN > 0 && <MoneyBubble kind="none" size={12}>{openN} open play</MoneyBubble>}
                  {blockedN > 0 && <MoneyBubble kind="loss" size={12}>{blockedN} blocked</MoneyBubble>}
                  <span style={{ flex: 1 }} />
                  {boardDate >= today && <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Drag a booking to another court or time</span>}
                </div>
              )
            })()}
            {/* Courts across the top, hours down the side. The other way round
                -- sixteen hourly columns sharing the width -- gave every
                booking about sixty pixels to say who was playing, which is
                why a single first name looked squashed and four of them were
                never going to fit. A court column is now several hundred
                pixels wide, and a two-hour booking is one tall block rather
                than a sliver. */}
            <div className="bd-card" ref={dayCardRef} style={{ position: 'relative', border: '1px solid var(--border)', borderRadius: 12, overflow: 'auto', maxHeight: '72vh' }}>
            <table className="bd-table w-full table-fixed text-sm border-collapse" style={{ minWidth: 68 + venueCourts.length * 150 }}>
              <thead>
                <tr>
                  <th className="bd-th bd-sticky px-2 py-2 text-left" style={{ width: 68, position: 'sticky', top: 0, zIndex: 2, fontSize: 11, fontWeight: 700, letterSpacing: 0.3, background: 'var(--bg-raised)', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>Time</th>
                  {venueCourts.map((court: any, idx: number) => (
                    <th key={court.id} className="bd-th bd-sticky px-2 py-2 text-center" style={{ position: 'sticky', top: 0, zIndex: 2, fontSize: 12, fontWeight: 700, letterSpacing: 0.2, color: 'var(--text-primary)', background: 'var(--bg-raised)', borderBottom: '1px solid var(--border)', borderRight: idx === venueCourts.length - 1 ? 'none' : '1px solid var(--border)' }}><CourtTile name={court.name} /></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const isPastDay = boardDate < today
                  // One plan per court: for each hour, either the start of a
                  // booking and how many rows it covers, a row already covered
                  // by the booking above, or an empty slot. A booking's span is
                  // vertical now, and rowSpan needs it worked out before the
                  // rows are rendered rather than while walking one.
                  const plans: ({ kind: 'empty' } | { kind: 'covered' } | { kind: 'start'; b: any; span: number })[][] =
                    venueCourts.map((court: any) => {
                      const plan: any[] = []
                      let i = 0
                      while (i < TIME_ROWS.length) {
                        const t = TIME_ROWS[i]
                        const b = bookings.find((b: any) => b.court_id === court.id && b.date === boardDate && b.status !== 'cancelled' && b.start_time.slice(0, 5) <= t && b.end_time.slice(0, 5) > t)
                        if (!b) { plan[i] = { kind: 'empty' }; i += 1; continue }
                        let span = 1
                        while (i + span < TIME_ROWS.length && TIME_ROWS[i + span] < b.end_time.slice(0, 5)) span++
                        plan[i] = { kind: 'start', b, span }
                        for (let k = 1; k < span; k++) plan[i + k] = { kind: 'covered' }
                        i += span
                      }
                      return plan
                    })

                  return TIME_ROWS.map((t, rowIdx) => (
                    <tr key={t}>
                      <td className="bd-time px-2 font-medium whitespace-nowrap align-top" data-now={boardDate === today && nowHour === parseInt(t) ? 'true' : undefined} style={{ paddingTop: 6, height: DAY_ROW_HEIGHT, fontSize: 11, fontWeight: boardDate === today && nowHour === parseInt(t) ? 800 : undefined, background: boardDate === today && nowHour === parseInt(t) ? 'var(--brand-primary)' : 'var(--bg-surface)', color: boardDate === today && nowHour === parseInt(t) ? '#ffffff' : 'var(--text-muted)', borderBottom: rowIdx === TIME_ROWS.length - 1 ? 'none' : '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
                        {fmtHour(t)}
                      </td>
                      {venueCourts.map((court: any, colIdx: number) => {
                        const slot = plans[colIdx][rowIdx]
                        // Swallowed by the rowSpan of the booking above it.
                        if (slot?.kind === 'covered') return null

                        const cellKey = `${court.id}-${t}`
                        const isDragOver = dragOverCell === cellKey && !isPastDay
                        const edge = {
                          borderBottom: '1px solid var(--border)',
                          borderRight: colIdx === venueCourts.length - 1 ? 'none' : '1px solid var(--border)',
                        }
                        const dropHandlers = {
                          onDragOver: (e: any) => { if (!isPastDay) { e.preventDefault(); setDragOverCell(cellKey) } },
                          onDragLeave: () => setDragOverCell(prev => (prev === cellKey ? null : prev)),
                        }

                        if (slot?.kind !== 'start') {
                          return (
                            <td key={court.id} className="bd-td align-top" data-over={isDragOver ? 'true' : undefined} {...dropHandlers}
                              onDrop={e => {
                                e.preventDefault()
                                setDragOverCell(null)
                                const id = e.dataTransfer.getData('text/booking-id') || draggedId
                                setDraggedId(null)
                                if (!id || isPastDay) return
                                moveBooking(id, { newCourtId: court.id, newStartTime: t })
                              }}
                              style={{ height: DAY_ROW_HEIGHT, padding: 4, background: isDragOver ? 'var(--brand-primary-muted)' : 'var(--bg-surface)', ...edge, boxShadow: isDragOver ? 'inset 0 0 0 2px var(--brand-primary)' : 'none', transition: 'background 0.1s' }} />
                          )
                        }

                        const b = slot.b
                        const appearance = cellAppearance(b)
                        return (
                          <td key={court.id} rowSpan={slot.span} className="bd-td align-top" {...dropHandlers}
                            onDrop={e => {
                              e.preventDefault()
                              setDragOverCell(null)
                              const id = e.dataTransfer.getData('text/booking-id') || draggedId
                              setDraggedId(null)
                              if (!id || isPastDay || id === b.id) return
                              moveBooking(id, { newCourtId: court.id, newStartTime: t })
                            }}
                            style={{ padding: 4, background: 'var(--bg-surface)', ...edge }}>
                            <div
                              draggable={!isPastDay && !moving}
                              onDragStart={e => {
                                e.dataTransfer.setData('text/booking-id', b.id)
                                e.dataTransfer.effectAllowed = 'move'
                                setDraggedId(b.id)
                              }}
                              onDragEnd={() => { setDraggedId(null); setDragOverCell(null) }}
                              onClick={() => {
                                if (b.status === 'blocked') return
                                setRosterBooking({
                                  id: b.id,
                                  title: `${court.name} · ${fmtClockRange(b.start_time, b.end_time)}`,
                                  subtitle: `${formatDate(boardDate)} · ${publicBookingIdSet.has(b.id) ? 'Open play' : 'Regular booking'}`,
                                })
                              }}
                              title={b.status === 'blocked' ? undefined : 'Click to view players and payment status; drag to reschedule'}
                              className="bd-block flex flex-col items-center justify-center gap-0.5 px-2"
                              // The block owns its slot outright, so it fills
                              // the cell with the name centred. There is room
                              // for the times underneath now, which saves
                              // opening the panel to answer "when does this
                              // one finish?".
                              style={{ ...moneyVars(boardKind(b)), ...dayBlockSize(b, slot.span), fontSize: 12, fontWeight: 600, borderRadius: 6, background: appearance.background, color: appearance.color, cursor: isPastDay ? 'default' : 'grab', opacity: draggedId === b.id ? 0.4 : 1 }}>
                              <span className="truncate max-w-full">{appearance.label}</span>
                              <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.72 }}>
                                {fmtClockRange(b.start_time, b.end_time)}
                              </span>
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))
                })()}
              </tbody>
            </table>
            {nowTop != null && <div data-testid="board-now-line" className="hidden md:block" style={{ position: 'absolute', left: 98, right: 14, top: nowTop, borderTop: '2px solid var(--text-primary)', opacity: 0.85, zIndex: 1, pointerEvents: 'none' }} />}
            </div>
            <BoardCategoryLegend />
            <BoardStatusLegend />
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
                      {formatDate(dayDetail)}
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
                            {b.price_nzd > 0 ? formatPrice(b.price_nzd, currencyForVenueSlug(b.courts?.venue_slug)) : '—'}
                          </div>
                        </div>
                        <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                          {b.courts?.name} · {fmtClockRange(b.start_time, b.end_time)}
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
        {rosterBooking && (
          <div className="hidden md:block shrink-0" style={{ width: 272 }}>
            <BookingRosterModal
              inline
              bookingId={rosterBooking.id}
              title={rosterBooking.title}
              subtitle={rosterBooking.subtitle}
              currency={venueCurrency}
              onClose={() => setRosterBooking(null)}
            />
          </div>
        )}
      </div>

      {/* Phone only: nowhere to dock, so it stays a bottom sheet. */}
      {rosterBooking && (
        <div className="md:hidden">
          <BookingRosterModal
            bookingId={rosterBooking.id}
            title={rosterBooking.title}
            subtitle={rosterBooking.subtitle}
            currency={venueCurrency}
            onClose={() => setRosterBooking(null)}
          />
        </div>
      )}
    </div>
  )
}
