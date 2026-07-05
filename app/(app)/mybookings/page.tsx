import { createServerClient } from '@/lib/supabase-server'
import MyBookingsList from '@/components/booking/MyBookingsList'
export default async function MyBookingsPage() {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  const [{ data: bookings }, { data: profile }, { data: splitRequests }, { data: outgoingSplits }, { data: joinedGames }] = await Promise.all([
    supabase
      .from('bookings')
      .select('*, courts(*)')
      .eq('user_id', session!.user.id)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true }),
    supabase.from('profiles').select('*').eq('id', session!.user.id).single(),
    supabase
      .from('booking_splits')
      .select('*, bookings(date, start_time, end_time, courts(name, type)), profiles!booking_splits_invited_by_fkey(nickname, full_name)')
      .eq('user_id', session!.user.id)
      .eq('status', 'pending'),
    supabase
      .from('booking_splits')
      .select('*, profiles!booking_splits_user_id_fkey(nickname, full_name)')
      .eq('invited_by', session!.user.id),
    supabase
      .from('booking_splits')
      .select('*, bookings(*, courts(*)), profiles!booking_splits_invited_by_fkey(nickname, full_name)')
      .eq('user_id', session!.user.id)
      .eq('status', 'paid'),
  ])
  return (
    <div>
      <div className="mb-6" style={{ userSelect: 'none' }}>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>My bookings</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Your upcoming and past court reservations</p>
      </div>
      <MyBookingsList bookings={bookings ?? []} profile={profile!} splitRequests={splitRequests ?? []} outgoingSplits={outgoingSplits ?? []} joinedGames={joinedGames ?? []} />
    </div>
  )
}
