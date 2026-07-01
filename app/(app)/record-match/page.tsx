import { createServerClient } from '@/lib/supabase-server'
import RecordMatchForm from '@/components/matches/RecordMatchForm'

export default async function RecordMatchPage() {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  const { data: players } = await supabase
    .from('profiles')
    .select('id, full_name, nickname, ranking_points')
    .not('role', 'eq', 'staff')
    .order('full_name', { ascending: true })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Record a match</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Enter the result to update the leaderboard</p>
      </div>
      <RecordMatchForm players={players ?? []} currentUserId={session!.user.id} />
    </div>
  )
}
