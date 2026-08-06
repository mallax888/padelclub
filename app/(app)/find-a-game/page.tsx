import { createServerClient } from '@/lib/supabase-server'
import FindGameList from '@/components/matches/FindGameList'

export default async function FindGamePage() {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  // This runs on the server, which has no idea what timezone the visitor is
  // in, so "today" can't be computed precisely here the way it can in a
  // client component. Querying from yesterday (server's UTC date) errs
  // toward occasionally showing an already-started match rather than
  // hiding a currently-open one for venues ahead of UTC (all of NZ/AU/SA).
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const { data: matches } = await supabase
    .from('open_matches')
    .select(`
      *,
      courts(name, type),
      open_match_players(id, player_id, status, profiles(id, full_name, nickname, skill_rating, skill_level, email))
    `)
    .eq('visibility', 'public')
    .in('status', ['open', 'full'])
    .gte('date', cutoff)
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
