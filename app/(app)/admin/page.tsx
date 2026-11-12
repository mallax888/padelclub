import { createServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AdminDashboard from '@/components/admin/AdminDashboard'
import { computeClubAnalytics } from '@/lib/analytics'
import { localDateStr } from '@/lib/utils'
import { addDays, format } from 'date-fns'
import { VENUES, COUNTRIES } from '@/lib/venues'
import { mapUnpaidShares, unpaidSharesQuery } from '@/lib/unpaid-shares'
import { ADMIN_TABS, canOpenTab, isOwnerRole } from '@/lib/view-mode'
import { loadVenueSettings } from '@/lib/venue-settings'
import { createAdminClient } from '@/lib/supabase-admin'
import { loadWaitlistDemand } from '@/lib/waitlist'
import { loadOfferRows } from '@/lib/offers'
import { loadPlanRows } from '@/lib/club-plans'

export default async function AdminPage({ searchParams }: { searchParams?: { tab?: string; venue?: string } }) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session!.user.id)
    .single()

  if (!profile || !['staff','admin'].includes((profile as any).role)) {
    redirect('/book')
  }

  // Front desk can open Board, Bookings and Members; the money and settings tabs
  // send them back to Today.
  const requestedTab = searchParams?.tab
  if (requestedTab && (ADMIN_TABS as readonly string[]).includes(requestedTab) && !canOpenTab((profile as any).role, requestedTab)) {
    redirect('/admin/today')
  }

  // Owner or front desk. Front desk never receives the money: the pages they
  // can't open aren't just hidden, their data is never sent -- no revenue
  // analytics, credit records, per-court takings, amounts owed, or booking prices.
  const isOwner = isOwnerRole((profile as any).role)

  // A scoped club manager (managed_venue_slug set) only ever sees their own
  // venue's data here -- RLS backs this up for writes (see
  // 017_country_scoped_staff.sql), but courts/bookings also have public
  // read policies (any member needs to see every venue's availability to
  // book), so cross-venue rows aren't blocked by RLS alone for reads.
  // Filtering explicitly here is what actually restricts Admin's own view.
  // An unscoped staff/admin (the default) is unaffected.
  const managedVenueSlug: string | null = (profile as any).managed_venue_slug ?? null

  // Broader than managed_venue_slug: a club owner scoped to a whole country
  // (no specific venue) manages every venue in that country but should
  // never see another country's data -- e.g. a real NZ club owner
  // shouldn't see South Africa's bookings/members/revenue just because
  // this deployment also hosts other countries' clubs. Only takes effect
  // when managed_venue_slug isn't already set (that's the narrower scope).
  const managedCountry: string | null = (profile as any).managed_country ?? null
  const managedCountryVenueSlugs: string[] | null =
    !managedVenueSlug && managedCountry
      ? VENUES.filter(v => COUNTRIES.find(c => c.name === managedCountry)?.regions.includes(v.region)).map(v => v.slug)
      : null

  // Bounded on the past only (no upper bound) -- a row-count limit ordered
  // oldest-first would silently show ancient history once a club passes
  // that many bookings ever, freezing the whole Board/Bookings view and the
  // stat cards on stale data instead of anything current or upcoming.
  const ninetyDaysAgo = format(addDays(new Date(), -90), 'yyyy-MM-dd')

  let bookingsQuery = supabase
    .from('bookings')
    .select('*, profiles(full_name, membership_tier), courts!inner(name, type, venue_slug)')
    .gte('date', ninetyDaysAgo)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true })
  let courtsQuery = supabase.from('courts').select('*').order('name')
  let membersQuery = supabase
    .from('profiles')
    .select('*')
    .eq('role', 'member')
    .order('created_at', { ascending: false })

  // Wide enough to compute both the weekly trend (last 8 weeks) and each
  // member's most recent booking for the "drifting away" list -- see
  // lib/analytics.ts.
  let analyticsBookingsQuery = supabase
    .from('bookings')
    .select('user_id, court_id, date, price_nzd, status, courts!inner(venue_slug)')
    .gte('date', ninetyDaysAgo)

  // Bounded to just over a year so the Court Performance "year" view has a
  // full 365 days to work with -- separate from analyticsBookingsQuery above
  // since that one only needs 90 days.
  const oneYearAgo = format(addDays(new Date(), -370), 'yyyy-MM-dd')
  let courtPerfQuery = supabase
    .from('bookings')
    .select('court_id, date, price_nzd, status, courts!inner(name, venue_slug)')
    .gte('date', oneYearAgo)

  // Same 90-day bound as bookingsQuery, for the Reports tab's credits
  // issued/used/refunded figures. credit_transactions isn't tied to a
  // venue directly -- scoped the same way its own RLS policy scopes it
  // (see 017_country_scoped_staff.sql): by the transacting member's
  // home_venue_slug.
  let creditTxQuery = supabase
    .from('credit_transactions')
    .select('created_at, amount, type, profiles!inner(home_venue_slug)')
    .gte('created_at', ninetyDaysAgo)

  // Which bookings are also public "find a game" matches -- open_matches
  // carries venue_slug directly, so it's scoped the same simple way courts
  // are, no join needed. Used purely to colour those cells differently on
  // the Board (see AdminDashboard) so staff can tell an open-to-anyone
  // booking apart from a private one at a glance.
  let openMatchesQuery = supabase
    .from('open_matches')
    .select('booking_id')
    .gte('date', ninetyDaysAgo)
    .not('booking_id', 'is', null)

  // Scoped like the other admin queries (see lib/unpaid-shares.ts).
  const unpaidSharesQ = unpaidSharesQuery(supabase, { venueSlug: managedVenueSlug, venueSlugs: managedCountryVenueSlugs })

  if (managedVenueSlug) {
    bookingsQuery = bookingsQuery.eq('courts.venue_slug', managedVenueSlug)
    courtsQuery = courtsQuery.eq('venue_slug', managedVenueSlug)
    membersQuery = membersQuery.eq('home_venue_slug', managedVenueSlug)
    analyticsBookingsQuery = analyticsBookingsQuery.eq('courts.venue_slug', managedVenueSlug)
    courtPerfQuery = courtPerfQuery.eq('courts.venue_slug', managedVenueSlug)
    creditTxQuery = creditTxQuery.eq('profiles.home_venue_slug', managedVenueSlug)
    openMatchesQuery = openMatchesQuery.eq('venue_slug', managedVenueSlug)
  } else if (managedCountryVenueSlugs) {
    bookingsQuery = bookingsQuery.in('courts.venue_slug', managedCountryVenueSlugs)
    courtsQuery = courtsQuery.in('venue_slug', managedCountryVenueSlugs)
    membersQuery = membersQuery.in('home_venue_slug', managedCountryVenueSlugs)
    analyticsBookingsQuery = analyticsBookingsQuery.in('courts.venue_slug', managedCountryVenueSlugs)
    courtPerfQuery = courtPerfQuery.in('courts.venue_slug', managedCountryVenueSlugs)
    creditTxQuery = creditTxQuery.in('profiles.home_venue_slug', managedCountryVenueSlugs)
    openMatchesQuery = openMatchesQuery.in('venue_slug', managedCountryVenueSlugs)
  }

  const [{ data: bookings }, { data: members }, { data: courts }, { data: analyticsBookings }, { data: courtPerfRows }, { data: creditTxRows }, { data: openMatchRows }, { data: unpaidShareRows }] = await Promise.all([
    bookingsQuery,
    membersQuery,
    courtsQuery,
    analyticsBookingsQuery,
    courtPerfQuery,
    creditTxQuery,
    openMatchesQuery,
    unpaidSharesQ,
  ])

  const unpaidShares = isOwner ? mapUnpaidShares(unpaidShareRows) : []

  // Owners only: how many people waited for full times, scoped to the clubs this
  // owner covers. null (table not set up yet) hides the card.
  const waitDemand = isOwner
    ? await loadWaitlistDemand(createAdminClient(), managedVenueSlug ? [managedVenueSlug] : managedCountryVenueSlugs ?? null)
    : null

  // Owners only: offers they've sent and what came of them. null (table not set up
  // yet) hides the Fill it buttons.
  const offers = isOwner
    ? await loadOfferRows(createAdminClient(), managedVenueSlug ? [managedVenueSlug] : managedCountryVenueSlugs ?? null)
    : null

  // Membership plans for the clubs this person covers, so the Members tab can show real
  // plan names (plan names are public; only owners get the Change button). null before
  // the club plans database change.
  const plans = await loadPlanRows(createAdminClient(), managedVenueSlug ? [managedVenueSlug] : managedCountryVenueSlugs ?? null)

  const venueSettings = await loadVenueSettings(supabase)

  const publicBookingIds = (openMatchRows ?? []).map((m: any) => m.booking_id as string)

  const creditTransactions = (isOwner ? (creditTxRows ?? []) : []).map((t: any) => ({
    created_at: t.created_at,
    amount: t.amount,
    type: t.type,
  }))

  const analytics = !isOwner ? null : computeClubAnalytics(
    (analyticsBookings ?? []).map((b: any) => ({
      user_id: b.user_id,
      court_id: b.court_id,
      date: b.date,
      price_nzd: b.price_nzd,
      status: b.status,
      venue_slug: b.courts?.venue_slug ?? null,
    })),
    (members ?? []) as any,
    courts?.length ?? 0,
    localDateStr()
  )

  const courtPerfBookings = (isOwner ? (courtPerfRows ?? []) : []).map((b: any) => ({
    court_id: b.court_id,
    court_name: b.courts?.name ?? 'Court',
    date: b.date,
    price_nzd: b.price_nzd,
    status: b.status,
    venue_slug: b.courts?.venue_slug ?? null,
  }))

  return (
    <AdminDashboard bookings={isOwner ? (bookings ?? []) : (bookings ?? []).map((b: any) => ({ ...b, price_nzd: 0 }))} canSeeMoney={isOwner} members={members ?? []} courts={courts ?? []} managedVenueSlug={managedVenueSlug} managedCountry={managedCountry} analytics={analytics} courtPerfBookings={courtPerfBookings} creditTransactions={creditTransactions} publicBookingIds={publicBookingIds} unpaidShares={unpaidShares} waitDemand={waitDemand} offers={offers} plans={plans} venueSettings={venueSettings} initialTab={(ADMIN_TABS as readonly string[]).includes(searchParams?.tab ?? '') ? (searchParams!.tab as typeof ADMIN_TABS[number]) : undefined} initialVenue={VENUES.some(v => v.slug === searchParams?.venue) ? searchParams!.venue : undefined} todayStr={localDateStr()} staffName={(profile as any).nickname ?? (profile as any).full_name ?? null} />
  )
}
