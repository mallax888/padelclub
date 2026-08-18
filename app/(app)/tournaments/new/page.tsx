import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import NewTournamentForm from '@/components/tournaments/NewTournamentForm'

export default async function NewTournamentPage() {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', session!.user.id).single()
  const isStaff = profile?.role === 'staff' || profile?.role === 'admin'
  if (!isStaff) {
    redirect('/tournaments')
  }

  const { data: players } = await supabase
    .from('profiles')
    .select('id, full_name, nickname')
    .not('role', 'eq', 'staff')
    .order('full_name', { ascending: true })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">New tournament</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Set up an Americano-format tournament day</p>
      </div>
      <NewTournamentForm players={players ?? []} organizerId={session!.user.id} />
    </div>
  )
}
