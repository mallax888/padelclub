import { createServerClient } from '@/lib/supabase-server'
import MyBookingsList from '@/components/booking/MyBookingsList'

export default async function MyBookingsPage() {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  const [{ data: bookings }, { data: profile }] = await Promise.all([
    supabase
      .from('bookings')
      .select('*, courts(*)')
      .eq('user_id', session!.user.id)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true }),
    supabase.from('profiles').select('*').eq('id', session!.user.id).single(),
  ])

  return (
    <div>
      <div className="mb-6 border-l-[3px] border-emerald-500 pl-3">
        <h1 className="text-2xl font-semibold text-slate-100">My bookings</h1>
        <p className="text-sm text-slate-400 mt-1">Your upcoming and past court reservations</p>
      </div>
      <MyBookingsList bookings={bookings ?? []} profile={profile!} />
    </div>
  )
}
