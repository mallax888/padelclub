import { createServerClient } from '@/lib/supabase-server'
import MyBookingsList from '@/components/booking/MyBookingsList'
import { stripeDashboardBase } from '@/lib/stripe'
import { loadVenueSettings } from '@/lib/venue-settings'
import { venueInstant, timezoneForVenueSlug } from '@/lib/timezone'
import { localDateStr } from '@/lib/utils'
export default async function MyBookingsPage() {
  const supabase = createServerClient()
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
      .select('*, bookings(date, start_time, end_time, courts(name, type, venue_slug)), profiles!booking_splits_invited_by_fkey(nickname, full_name)')
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
  // Times the player is waiting on. If the waitlist table isn't there yet this is
  // simply empty and the card never shows.
  const waitRes: any = await (supabase as any)
    .from('waitlist')
    .select('id, venue_slug, date, start_time, duration_minutes, status')
    .eq('user_id', session!.user.id)
    .in('status', ['waiting', 'notified'])
    .gte('date', localDateStr(new Date(Date.now() - 24 * 3600 * 1000)))
    .order('date', { ascending: true })
    .order('start_time', { ascending: true })
  // Active weekly regulars. Empty (and the card never shows) if the table isn't there yet.
  const regRes: any = await (supabase as any)
    .from('regulars')
    .select('id, venue_slug, start_time, duration_minutes, start_date, weeks, clash_dates, status')
    .eq('user_id', session!.user.id)
    .eq('status', 'active')
    .order('start_date', { ascending: true })
  const regulars = regRes.error ? [] : (regRes.data ?? [])
  const nowMs = Date.now()
  const waits = ((waitRes.error ? [] : waitRes.data ?? []) as any[])
    .filter(w => venueInstant(w.date, String(w.start_time).slice(0, 5) + ':00', timezoneForVenueSlug(w.venue_slug)).getTime() > nowMs)
  return (
    <div>
      <div className="mb-6" style={{ userSelect: 'none' }}>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>My bookings</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Your upcoming and past court reservations</p>
      </div>
      <MyBookingsList bookings={bookings ?? []} profile={profile!} splitRequests={splitRequests ?? []} outgoingSplits={outgoingSplits ?? []} joinedGames={joinedGames ?? []} currentUserId={session!.user.id} stripeDashboardBase={stripeDashboardBase()} venueSettings={venueSettings} waits={waits} regulars={regulars} />
    </div>
  )
}
