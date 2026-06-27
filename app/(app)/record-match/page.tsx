import { createServerClient } from '@/lib/supabase-server'
import RecordMatchForm from '@/components/matches/RecordMatchForm'

export default async function RecordMatchPage() {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  const { data: players } = await supabase
    .from('profiles')
    .select('id, full_name, nickname, skill_level, ranking_points')
    .not('role', 'in', '("staff","admin")')
    .order('full_name', { ascending: true })

  const { data: courts } = await supabase
    .from('courts')
    .select('id, name, type')
    .eq('is_active', true)
    .order('name')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Record a match</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Enter the result to update the leaderboard
        </p>
      </div>
      <RecordMatchForm
        players={players ?? []}
        courts={courts ?? []}
        currentUserId={session!.user.id}
      />
    </div>
  )
}
