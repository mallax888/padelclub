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

  if (!profile || !['staff','admin'].includes((profile as any).role)) {
    redirect('/book')
  }

  // A scoped club manager (managed_venue_slug set) only ever sees their own
  // venue's data here -- RLS backs this up for writes, but courts/bookings
  // also have public read policies (any member needs to see every venue's
  // availability to book), so cross-venue rows aren't blocked by RLS alone
  // for reads. Filtering explicitly here is what actually restricts Admin's
  // own view. An unscoped staff/admin (the default) is unaffected.
  const managedVenueSlug: string | null = (profile as any).managed_venue_slug ?? null

  let bookingsQuery = supabase
    .from('bookings')
    .select('*, profiles(full_name, membership_tier), courts!inner(name, type, venue_slug)')
    .order('date', { ascending: true })
    .order('start_time', { ascending: true })
    .limit(100)
  let courtsQuery = supabase.from('courts').select('*').order('name')
  let membersQuery = supabase
    .from('profiles')
    .select('*')
    .eq('role', 'member')
    .order('created_at', { ascending: false })

  if (managedVenueSlug) {
    bookingsQuery = bookingsQuery.eq('courts.venue_slug', managedVenueSlug)
    courtsQuery = courtsQuery.eq('venue_slug', managedVenueSlug)
    membersQuery = membersQuery.eq('home_venue_slug', managedVenueSlug)
  }

  const [{ data: bookings }, { data: members }, { data: courts }] = await Promise.all([
    bookingsQuery,
    membersQuery,
    courtsQuery,
  ])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="text-sm text-gray-500 mt-1">Manage bookings, members and courts</p>
      </div>
      <AdminDashboard bookings={bookings ?? []} members={members ?? []} courts={courts ?? []} managedVenueSlug={managedVenueSlug} />
    </div>
  )
}
