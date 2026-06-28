import { createServerClient } from '@/lib/supabase-server'
import RecordMatchForm from '@/components/matches/RecordMatchForm'

export default async function RecordMatchPage() {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  const { data: players } = await supabase
    .from('profiles')
    .select('id, full_name, nickname, ranking_points')
    .not('role', 'in', '("staff","admin")')
    .order('full_name', { ascending: true })

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const { data: monthlyMatches } = await supabase
    .from('matches')
    .select('winner_team, team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id')
    .gte('played_at', startOfMonth)

  const pointsMap: Record<string, { name: string; pts: number }> = {}

  for (const p of (players ?? []) as any[]) {
    pointsMap[p.id] = { name: p.nickname ?? p.full_name ?? 'Unknown', pts: 0 }
  }

  for (const m of monthlyMatches ?? []) {
    const winners = m.winner_team === 1
      ? [m.team1_player1_id, m.team1_player2_id]
      : [m.team2_player1_id, m.team2_player2_id]
    const losers = m.winner_team === 1
      ? [m.team2_player1_id, m.team2_player2_id]
      : [m.team1_player1_id, m.team1_player2_id]
    for (const id of winners.filter(Boolean)) {
      if (pointsMap[id]) pointsMap[id].pts += 10
    }
    for (const id of losers.filter(Boolean)) {
      if (pointsMap[id]) pointsMap[id].pts += 2
    }
  }

  const leaderboard = Object.entries(pointsMap)
    .map(([id, { name, pts }]) => ({ id, name, pts }))
    .filter(p => p.pts > 0)
    .sort((a, b) => b.pts - a.pts)
    .slice(0, 10)

  const monthName = now.toLocaleString('default', { month: 'long' })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Record a match</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Enter the result to update the leaderboard</p>
      </div>
      <RecordMatchForm
        players={players ?? []}
        currentUserId={session!.user.id}
        leaderboard={leaderboard}
        monthName={monthName}
      />
    </div>
  )
}

