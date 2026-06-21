import { createServerClient } from '@/lib/supabase-server'
import FindGameList from '@/components/matches/FindGameList'

export default async function FindGamePage() {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  const { data: matches } = await supabase
    .from('open_matches')
    .select(`
      *,
      courts(name, type),
      open_match_players(player_id, profiles(id, full_name, nickname, skill_rating))
    `)
    .eq('visibility', 'public')
    .eq('status', 'open')
    .gte('date', new Date().toISOString().slice(0, 10))
    .order('date', { ascending: true })
    .order('start_time', { ascending: true })

  return (
    <div>
      <div className="mb-6" style={{ userSelect: 'none' }}>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Find a game</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Join open matches and meet other players
        </p>
      </div>
      <FindGameList matches={matches ?? []} currentUserId={session?.user?.id ?? ''} />
    </div>
  )
}
