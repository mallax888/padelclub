import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import NewLadderForm from '@/components/ladders/NewLadderForm'

export default async function NewLadderPage() {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', session!.user.id).single()
  const isStaff = profile?.role === 'staff' || profile?.role === 'admin'
  if (!isStaff) {
    redirect('/ladders')
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">New ladder</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Players join, challenge their way up, and climb the ranking</p>
      </div>
      <NewLadderForm organizerId={session!.user.id} />
    </div>
  )
}
