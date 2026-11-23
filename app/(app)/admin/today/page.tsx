import { fmtClock } from '@/lib/clock'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { loadBriefing } from '@/lib/briefing-server'
import { offersReady } from '@/lib/offers'
import { pickFillSlot } from '@/lib/today-actions'
import { COUNTRIES, VENUES, getVenue } from '@/lib/venues'
import { currencyForVenueSlug } from '@/lib/currency'
import { timezoneForVenueSlug, venueInstant } from '@/lib/timezone'
import { isManagerRole, isOwnerRole, roleLabel } from '@/lib/view-mode'
import { computeCourtDay } from '@/lib/court-day'
import { computeCourtRevenue } from '@/lib/court-revenue'
import { addDaysStr, computeToday, greetingFor, venueClock, type TodayBooking } from '@/lib/today'
import { computeEmptyCourtTime, splitOverdueShares, summariseUnpaidShares } from '@/lib/money-demand'
import { mapUnpaidShares, unpaidSharesQuery } from '@/lib/unpaid-shares'
import { splitOn } from '@/lib/club-access'
import TodayView, { type TodayViewProps } from '@/components/admin/TodayView'
import PlayerPageNotice from '@/components/admin/PlayerPageNotice'
import { PLAYER_PAGES } from '@/lib/club-guard'
import Link from 'next/link'
import { loadVenueSettings, weekFor } from '@/lib/venue-settings'
import { dayHours } from '@/lib/venue-hours'

export const metadata = { title: 'Today' }

export const dynamic = 'force-dynamic'

const longDate = (d: string) =>
  new Intl.DateTimeFormat('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z'))
const shortWeekday = (d: string) =>
  new Intl.DateTimeFormat('en-NZ', { weekday: 'short', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z'))

export default async function TodayPage({ searchParams }: { searchParams?: { venue?: string; act?: string; player?: string } }) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, nickname, full_name, home_venue_slug, managed_venue_slug, managed_country')
    .eq('id', session!.user.id)
    .single()
  if (!profile || !isManagerRole((profile as any).role)) redirect('/')

  // Same scoping as the dashboard: a club manager sees their own club, a country
  // manager their country's clubs, an unscoped admin everything.
  const managedVenueSlug: string | null = (profile as any).managed_venue_slug ?? null
  const managedCountry: string | null = (profile as any).managed_country ?? null
  const inScope = (slug: string) =>
    managedVenueSlug ? slug === managedVenueSlug
      : managedCountry ? !!COUNTRIES.find(c => c.name === managedCountry)?.regions.includes(getVenue(slug).region)
      : true

  // Independent reads go out together instead of one after another: each round trip to the database costs real time on a phone.
  const [venueSettings, { data: courtRows }] = await Promise.all([
    loadVenueSettings(supabase),
    supabase.from('courts').select('id, name, venue_slug, is_active, price_per_hour, price_per_hour_peak').eq('is_active', true),
  ])
  const withCourts = new Set((courtRows ?? []).map((c: any) => c.venue_slug as string))
  const venues = VENUES.filter(v => withCourts.has(v.slug) && inScope(v.slug)).map(v => ({ slug: v.slug, name: v.name }))

  const firstName = ((profile as any).nickname ?? (profile as any).full_name ?? '').toString().split(' ')[0] || null
  if (venues.length === 0) {
    const owner = isOwnerRole((profile as any).role)
    const setupSlug = managedVenueSlug ?? ((profile as any).home_venue_slug as string | null)
    const clubName = setupSlug ? getVenue(setupSlug).name : null
    return (
      <div className="w-full max-w-[880px] mx-auto">
        <h1 className="text-2xl font-extrabold">Today</h1>
        {owner ? (
          <div className="rounded-[20px] p-6 mt-4 text-white" data-testid="welcome-setup" style={{ background: 'linear-gradient(160deg,#2c5fc4,#1d3f8d)' }}>
            <div className="text-[11px] font-extrabold uppercase" style={{ letterSpacing: '0.12em', color: '#cfe0ff' }}>Welcome{firstName ? `, ${firstName}` : ''}</div>
            <h2 className="text-[26px] font-black leading-tight mt-1" style={{ letterSpacing: '-0.02em' }}>{clubName ? `Let's get ${clubName} ready for bookings` : "Let's get your club ready for bookings"}</h2>
            <p className="text-sm mt-2" style={{ color: '#dbe7ff' }}>None of your clubs have courts set up yet. It takes about five minutes, and today&apos;s bookings will show here as soon as you are done.</p>
            <ol className="mt-4 flex flex-col gap-2 text-[14px] font-bold">
              {['Opening hours', 'Courts and prices', 'Invite your team'].map((t, i) => (
                <li key={t} className="flex items-center gap-3"><span className="flex items-center justify-center rounded-full text-[12px] font-extrabold shrink-0" style={{ width: 26, height: 26, background: '#ffffff', color: '#1d3f8d' }}>{i + 1}</span>{t}</li>
              ))}
            </ol>
            <Link href={setupSlug ? `/admin/setup?venue=${encodeURIComponent(setupSlug)}` : '/admin/setup'} data-testid="welcome-setup-go"
              className="mt-5 flex items-center justify-center rounded-xl text-[15px] font-extrabold w-full sm:w-auto sm:inline-flex sm:px-8" style={{ minHeight: 52, background: '#ffffff', color: '#1d3f8d' }}>Set up your club</Link>
          </div>
        ) : (
          <p className="text-sm mt-3" style={{ color: 'var(--text-muted)' }}>None of your clubs have courts set up yet. Ask the owner to set up the club.</p>
        )}
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
  // Owners also see yesterday and the fill-gap offer. Neither depends on today's bookings, so they load while those do.
  const ownerNow = isOwnerRole((profile as any).role)
  const briefingP = ownerNow ? loadBriefing(createAdminClient(), venueSlug, nowMs).then(v => ({ ok: true as const, v }), (err: unknown) => ({ ok: false as const, err })) : null
  const offersP = ownerNow ? offersReady(createAdminClient()) : null
  offersP?.catch(() => {})
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
  const courtDay = computeCourtDay({ courts: courts as any, bookings: bookings.filter(b => b.date === clock.date), date: clock.date, nowMinutes: clock.minutes, week })
  // Owners only: what each court has booked today against what it could earn (front desk never sees money).
  const courtRevenue = isOwner ? computeCourtRevenue({ courts: courts as any, bookings: bookings.filter(b => b.date === clock.date), day: courtDay, date: clock.date }) : null
  // Who is on each court, for the club map: the booker and the friends who have joined.
  const joined = ((splitRows ?? []) as any[]).filter(s => s.user_id && s.status !== 'cancelled')
  const joinedIds = Array.from(new Set(joined.map(s => s.user_id as string)))
  const nameOf = new Map<string, string>()
  if (joinedIds.length > 0) {
    const { data: nm } = await supabase.from('profiles').select('id, full_name, nickname').in('id', joinedIds)
    for (const pr of (nm ?? []) as any[]) nameOf.set(pr.id, pr.nickname ?? pr.full_name ?? '')
  }
  const mins = (t: string) => parseInt(t.slice(0, 2), 10) * 60 + parseInt(t.slice(3, 5), 10)
  const mapBookings = bookings.filter(b => b.date === clock.date).map(b => {
    const mine = joined.filter(s => s.booking_id === b.id)
    return {
      id: b.id, courtId: b.court_id, start: mins(b.start_time), end: mins(b.end_time), status: b.status, who: b.bookerName,
      people: b.status === 'blocked' ? [] : [b.bookerName ?? '?', ...mine.map(s => nameOf.get(s.user_id) || '?')].slice(0, 4),
      unpaid: mine.filter(s => s.status === 'pending').length + (b.status === 'pending' ? 1 : 0),
    }
  })
  const liveCount = (courtId: string, date: string) => bookings.filter(b => b.court_id === courtId && b.date === date && b.status !== 'cancelled' && b.status !== 'blocked').length
  const mapCourts = courts.map((c: any) => ({ id: c.id as string, name: c.name as string, today: liveCount(c.id, clock.date), lastWeek: liveCount(c.id, lastWeek) }))
  const hoursToday = dayHours(week, clock.date)
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
  const soonestLabel = soonest ? `${soonest.court} · ${soonest.date === clock.date ? 'today' : shortWeekday(soonest.date)} ${fmtClock(soonest.time)}` : null

  // Owners see yesterday at a glance; front desk never does (it has takings in it).
  let briefing: { b: any; weekday: string; yesterdayLabel: string; brandNew?: boolean } | null = null
  if (isOwner) {
    try {
      const got = await briefingP!
      if (got.ok === false) throw got.err
      const loaded = got.v
      if (loaded) briefing = { b: loaded.briefing, weekday: loaded.weekday, yesterdayLabel: `Yesterday, ${shortWeekday(loaded.yesterday)} ${new Intl.DateTimeFormat('en-NZ', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(loaded.yesterday + 'T12:00:00Z'))}` }
      // A club that has never had a booking is brand new: "yesterday was quiet" would read like a failure.
      if (briefing && briefing.b.bookings === 0) {
        const { data: ever } = await supabase.from('bookings').select('id, courts!inner(venue_slug)').eq('courts.venue_slug', venueSlug).lt('date', clock.date).limit(1)
        briefing.brandNew = (ever ?? []).length === 0
      }
    } catch (err) { console.error('Could not load the morning briefing card', err) }
  }

  // Owners can act on the overdue shares and on the biggest empty gap right here.
  let actions: TodayViewProps['actions'] = null
  if (isOwner) {
    const split = splitOverdueShares(mapUnpaidShares(unpaidRows), venueSlug, nowMs)
    const offersOn = await offersP!
    const hours = dayHours(week, clock.date)
    const gap = offersOn ? pickFillSlot(empty.slots, nowMs, tz) : null
    actions = {
      overdue: { lines: split.overdue.map(l => ({ id: l.id, playerName: l.playerName, organiserName: l.organiserName, courtName: l.courtName, date: l.date, startTime: l.startTime, amount: l.amount })), total: split.overdueTotal, notDueCount: split.notDueCount, notDueTotal: split.notDueTotal },
      offersOn,
      fill: gap && hours ? { gap, bounds: { from: hours.open, to: hours.close } } : null,
      autoOpen: searchParams?.act === 'fill' ? 'fill' : searchParams?.act === 'remind' ? 'remind' : null,
    }
  }

  const playerPath = searchParams?.player && PLAYER_PAGES[searchParams.player] ? searchParams.player : null
  return (
    <>
    {playerPath && <PlayerPageNotice path={playerPath} name={PLAYER_PAGES[playerPath]} />}
    <TodayView
      canSwitchView={!splitOn()}
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
      briefing={briefing}
      courtDay={courtDay}
      courtRevenue={courtRevenue}
      map={{ courts: mapCourts, bookings: mapBookings, takings: summary.revenue.today, bounds: hoursToday ? { from: hoursToday.open, to: hoursToday.close } : null, date: clock.date }}
      nowMinutes={clock.minutes}
      actions={actions}
    />
    </>
  )
}
