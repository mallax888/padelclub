import { createServerClient } from '@/lib/supabase-server'
import BookingFlow from '@/components/booking/BookingFlow'

export default async function BookPage() {
  const supabase = createServerClient()

  const [{ data: courts }, { data: { session } }] = await Promise.all([
    supabase.from('courts').select('*').eq('is_active', true),
    supabase.auth.getSession(),
  ])

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session!.user.id)
    .single()

  const { data: allPlayers } = await supabase
    .from('profiles')
    .select('id, full_name, nickname')
    .not('role', 'in', '("staff","admin")')
    .order('full_name')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Book a court</h1>
        <p className="text-sm text-gray-500 mt-1">Select a date, court and time to make your booking</p>
      </div>
      <BookingFlow courts={courts ?? []} profile={profile!} userId={session!.user.id} allPlayers={allPlayers ?? []} />
    </div>
  )
}



