import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import { COUNTRIES, VENUES, getVenue } from '@/lib/venues'
import { currencyForVenueSlug } from '@/lib/currency'
import { timezoneForVenueSlug, venueInstant } from '@/lib/timezone'
import { isManagerRole, isOwnerRole, roleLabel } from '@/lib/view-mode'
import { addDaysStr, computeToday, greetingFor, venueClock, type TodayBooking } from '@/lib/today'
import { computeEmptyCourtTime, summariseUnpaidShares } from '@/lib/money-demand'
import { mapUnpaidShares, unpaidSharesQuery } from '@/lib/unpaid-shares'
import TodayView from '@/components/admin/TodayView'
import Link from 'next/link'
import { loadVenueSettings, weekFor } from '@/lib/venue-settings'
import { dayHours } from '@/lib/venue-hours'

export const metadata = { title: 'Today' }

export const dynamic = 'force-dynamic'

const longDate = (d: string) =>
  new Intl.DateTimeFormat('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z'))
const shortWeekday = (d: string) =>
  new Intl.DateTimeFormat('en-NZ', { weekday: 'short', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z'))

export default async function TodayPage({ searchParams }: { searchParams?: { venue?: string } }) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, nickname, full_name, home_venue_slug, managed_venue_slug, managed_country')
    .eq('id', session!.user.id)
    .single()
  if (!profile || !isManagerRole((profile as any).role)) redirect('/book')

  // Same scoping as the dashboard: a club manager sees their own club, a country
  // manager their country's clubs, an unscoped admin everything.
  const managedVenueSlug: string | null = (profile as any).managed_venue_slug ?? null
  const managedCountry: string | null = (profile as any).managed_country ?? null
  const inScope = (slug: string) =>
    managedVenueSlug ? slug === managedVenueSlug
      : managedCountry ? !!COUNTRIES.find(c => c.name === managedCountry)?.regions.includes(getVenue(slug).region)
      : true

  const venueSettings = await loadVenueSettings(supabase)
  const { data: courtRows } = await supabase.from('courts').select('id, name, venue_slug, is_active, price_per_hour, price_per_hour_peak').eq('is_active', true)
  const withCourts = new Set((courtRows ?? []).map((c: any) => c.venue_slug as string))
  const venues = VENUES.filter(v => withCourts.has(v.slug) && inScope(v.slug)).map(v => ({ slug: v.slug, name: v.name }))

  const firstName = ((profile as any).nickname ?? (profile as any).full_name ?? '').toString().split(' ')[0] || null
  if (venues.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-extrabold">Today</h1>
        <p className="text-sm mt-3" style={{ color: 'var(--text-muted)' }}>
          None of your clubs have courts set up yet.{isOwnerRole((profile as any).role) ? <> <Link href="/admin/setup" style={{ color: 'var(--brand-primary-text)', fontWeight: 700 }}>Set up your club</Link> and today&apos;s bookings will show here.</> : ' Ask the owner to set up the club.'}
        </p>
      </div>
    )
  }

  const wanted = searchParams?.venue
  const home = (profile as any).home_venue_slug as string | null
  const venueSlug = venues.some(v => v.slug === wanted) ? wanted!
    : venues.some(v => v.slug === managedVenueSlug) ? managedVenueSlug!
    : venues.some(v => v.slug === home) ? home!
    : venues[0].slug

  const nowMs = Date.now()
  const clock = venueClock(venueSlug, nowMs)
  const lastWeek = addDaysStr(clock.date, -7)
  const courts = (courtRows ?? []).filter((c: any) => c.venue_slug === venueSlug)
  const courtIds = courts.map((c: any) => c.id as string)

  const { data: bookingRows } = await supabase
    .from('bookings')
    .select('id, user_id, court_id, date, start_time, end_time, status, price_nzd, profiles(full_name, nickname)')
    .in('court_id', courtIds)
    .in('date', [clock.date, lastWeek])
  const bookings: TodayBooking[] = (bookingRows ?? []).map((b: any) => ({
    id: b.id, user_id: b.user_id, court_id: b.court_id, date: b.date, start_time: b.start_time, end_time: b.end_time,
    status: b.status, price_nzd: b.price_nzd, bookerName: b.profiles?.nickname ?? b.profiles?.full_name ?? null,
  }))

  const bookingIds = bookings.map(b => b.id)
  const [{ data: splitRows }, { data: unpaidRows }, { data: seatRows }] = await Promise.all([
    bookingIds.length
      ? supabase.from('booking_splits').select('booking_id, user_id, status').in('booking_id', bookingIds)
      : Promise.resolve({ data: [] as any[] }),
    unpaidSharesQuery(supabase, { venueSlug }),
    // Invite links nobody has used yet (needs migration 023; without it this is just empty).
    (supabase.from('booking_splits') as any)
      .select('id, bookings!inner(date, start_time, status, courts!inner(name, venue_slug))')
      .is('user_id', null).eq('status', 'pending').not('invite_token', 'is', null)
      .eq('bookings.courts.venue_slug', venueSlug).gte('bookings.date', clock.date).limit(200),
  ])

  const isOwner = isOwnerRole((profile as any).role)
  const computed = computeToday({ courts, bookings, splits: (splitRows ?? []) as any, today: clock.date, nowMinutes: clock.minutes })
  // Front desk never receives the takings: zeroed here, not just hidden on screen.
  const summary = isOwner ? computed : { ...computed, revenue: { today: 0, lastWeek: 0 } }
  const unpaid = summariseUnpaidShares(mapUnpaidShares(unpaidRows), venueSlug, nowMs)
  const week = weekFor(venueSettings, venueSlug)
  const empty = computeEmptyCourtTime(courts as any, bookings.filter(b => b.date === clock.date), venueSlug, nowMs, 1, week)
  const closeToday = dayHours(week, clock.date)?.close ?? null

  // Open invite spots in games that start within the next 24 hours.
  const tz = timezoneForVenueSlug(venueSlug)
  const seats = ((seatRows ?? []) as any[])
    .map(r => ({ court: r.bookings?.courts?.name as string, date: r.bookings?.date as string, time: r.bookings?.start_time as string, status: r.bookings?.status as string }))
    .filter(r => r.date && r.status !== 'cancelled' && r.status !== 'blocked')
    .map(r => ({ ...r, at: venueInstant(r.date, r.time, tz).getTime() }))
    .filter(r => r.at > nowMs && r.at <= nowMs + 24 * 3600 * 1000)
    .sort((a, b) => a.at - b.at)
  const soonest = seats[0]
  const soonestLabel = soonest ? `${soonest.court} · ${soonest.date === clock.date ? 'today' : shortWeekday(soonest.date)} ${soonest.time.slice(0, 5)}` : null

  return (
    <TodayView
      venueSlug={venueSlug}
      venues={venues}
      greeting={greetingFor(clock.hour)}
      staffName={firstName}
      dateLabel={longDate(clock.date)}
      lastWeekLabel={shortWeekday(lastWeek)}
      currency={currencyForVenueSlug(venueSlug)}
      summary={summary}
      unpaid={{ count: unpaid.count, total: isOwner ? unpaid.total : null, oldestDays: unpaid.rows[0]?.ageDays ?? null }}
      openSeats={{ count: seats.length, soonest: soonestLabel }}
      emptyHoursToday={empty.days[0]?.empty ?? 0}
      closeToday={closeToday}
      notOpenYet={isOwner && venueSettings[venueSlug]?.isOpen === false}
      showMoney={isOwner}
      roleLabel={roleLabel((profile as any).role)}
    />
  )
}
