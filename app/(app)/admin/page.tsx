import { createServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AdminDashboard from '@/components/admin/AdminDashboard'

export default async function AdminPage() {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session!.user.id)
    .single()

  if (!profile || !['staff','admin'].includes(profile.role)) {
    redirect('/book')
  }

  const [{ data: bookings }, { data: members }, { data: courts }] = await Promise.all([
    supabase
      .from('bookings')
      .select('*, profiles(full_name, membership_tier), courts(name, type)')
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(100),
    supabase
      .from('profiles')
      .select('*')
      .eq('role', 'member')
      .order('created_at', { ascending: false }),
    supabase
      .from('courts')
      .select('*')
      .order('name'),
  ])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="text-sm text-gray-500 mt-1">Manage bookings, members and courts</p>
      </div>
      <AdminDashboard bookings={bookings ?? []} members={members ?? []} courts={courts ?? []} />
    </div>
  )
}
