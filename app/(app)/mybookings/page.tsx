import { keepClubAccountsOut } from '@/lib/club-guard'
import { prepayReady } from '@/lib/regulars'
import { createServerClient } from '@/lib/supabase-server'
import Link from 'next/link'
import MyBookingsList from '@/components/booking/MyBookingsList'
import { stripeDashboardBase } from '@/lib/stripe'
import { loadVenueSettings } from '@/lib/venue-settings'
import { venueInstant, timezoneForVenueSlug } from '@/lib/timezone'
import { localDateStr } from '@/lib/utils'
import { effectivePlans, planOf } from '@/lib/plan-rules'
import { loadPlanRows } from '@/lib/club-plans'

export const metadata = { title: 'My bookings' }
export default async function MyBookingsPage() {
  const supabase = createServerClient()
  await keepClubAccountsOut(supabase, '/mybookings')
  const { data: { session } } = await supabase.auth.getSession()
  const [{ data: bookings }, { data: profile }, { data: splitRequests }, { data: outgoingSplits }, { data: joinedGames }, venueSettings] = await Promise.all([
    supabase
      .from('bookings')
      .select('*, courts(*)')
      .eq('user_id', session!.user.id)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true }),
    supabase.from('profiles').select('*').eq('id', session!.user.id).single(),
    supabase
      .from('booking_splits')
      .select('*, bookings(date, start_time, end_time, created_at, courts(name, type, venue_slug)), profiles!booking_splits_invited_by_fkey(nickname, full_name)')
      .eq('user_id', session!.user.id)
      .eq('status', 'pending'),
    supabase
      .from('booking_splits')
      .select('*, profiles!booking_splits_user_id_fkey(nickname, full_name)')
      .eq('invited_by', session!.user.id),
    supabase
      .from('booking_splits')
      .select('*, bookings(*, courts(*), booking_splits(user_id, status, profiles!booking_splits_user_id_fkey(nickname, full_name))), profiles!booking_splits_invited_by_fkey(nickname, full_name)')
      .eq('user_id', session!.user.id)
      .eq('status', 'paid'),
    loadVenueSettings(supabase),
  ])
  // Times the player is waiting on (empty if the waitlist table isn't there yet), their active weekly regulars (empty if
  // the table isn't there yet), whether unpaid shares have a deadline (once the share-deadline change is run) and whether
  // pay-ahead is on. Four independent reads, so they go out together.
  const [waitRes, regRes, sharesProbe, prepayOn] = await Promise.all([
    (supabase as any)
      .from('waitlist')
      .select('id, venue_slug, date, start_time, duration_minutes, status')
      .eq('user_id', session!.user.id)
      .in('status', ['waiting', 'notified'])
      .gte('date', localDateStr(new Date(Date.now() - 24 * 3600 * 1000)))
      .order('date', { ascending: true })
      .order('start_time', { ascending: true }),
    (supabase as any)
      .from('regulars')
      .select('id, venue_slug, start_time, duration_minutes, start_date, weeks, clash_dates, status')
      .eq('user_id', session!.user.id)
      .eq('status', 'active')
      .order('start_date', { ascending: true }),
    (supabase as any).from('booking_splits').select('covered_by').limit(1),
    prepayReady(supabase as any),
  ]) as [any, any, any, boolean]
  const regulars = regRes.error ? [] : (regRes.data ?? [])
  const sharesOn = !sharesProbe.error
  // Bookings made before the share deadline existed are exempt from it. That flag is
  // read separately (not in the main query above) so a database without the column
  // can't break the list of shares you owe.
  let splitReqs: any[] = splitRequests ?? []
  if (sharesOn && splitReqs.length > 0) {
    const { data: flags } = await (supabase as any).from('bookings').select('id, share_deadline_exempt').in('id', splitReqs.map((s: any) => s.booking_id))
    const exempt = new Set(((flags ?? []) as any[]).filter(f => f.share_deadline_exempt).map(f => f.id))
    splitReqs = splitReqs.map((s: any) => (exempt.has(s.booking_id) && s.bookings ? { ...s, bookings: { ...s.bookings, share_deadline_exempt: true } } : s))
  }
  const nowMs = Date.now()
  const waits = ((waitRes.error ? [] : waitRes.data ?? []) as any[])
    .filter(w => venueInstant(w.date, String(w.start_time).slice(0, 5) + ':00', timezoneForVenueSlug(w.venue_slug)).getTime() > nowMs)
  // Their plan at their home club: its name, and how many days ahead they can book.
  const home: string | null = (profile as any)?.home_venue_slug ?? null
  const mp = home ? planOf(effectivePlans(await loadPlanRows(supabase as any, [home]), home), (profile as any)?.membership_tier) : null
  const memberPlan = mp ? { name: mp.name, windowDays: mp.windowDays } : null

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-3" style={{ userSelect: 'none' }}>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>My bookings</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Your courts, in order</p>
        </div>
        <Link href="/book" data-testid="new-booking" aria-label="New booking" className="shrink-0 rounded-full px-4 text-[13px] font-extrabold inline-flex items-center" style={{ minHeight: 40, background: 'var(--brand-primary)', color: 'var(--brand-primary-on)' }}>+ New</Link>
      </div>
      <MyBookingsList bookings={bookings ?? []} profile={profile!} splitRequests={splitReqs} outgoingSplits={outgoingSplits ?? []} joinedGames={joinedGames ?? []} currentUserId={session!.user.id} stripeDashboardBase={stripeDashboardBase()} venueSettings={venueSettings} waits={waits} regulars={regulars} sharesOn={sharesOn} prepayOn={prepayOn} plan={memberPlan} />
    </div>
  )
}
