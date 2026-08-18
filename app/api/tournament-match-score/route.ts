import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

export async function POST(request: Request) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { matchId, team1Score, team2Score } = await request.json()
  if (!matchId || typeof team1Score !== 'number' || typeof team2Score !== 'number') {
    return NextResponse.json({ error: 'Missing matchId, team1Score or team2Score' }, { status: 400 })
  }
  if (team1Score < 0 || team2Score < 0) {
    return NextResponse.json({ error: 'Scores cannot be negative' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: match } = await admin
    .from('tournament_matches')
    .select('id, status, team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id')
    .eq('id', matchId)
    .maybeSingle()

  if (!match) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 })
  }
  if (match.status === 'completed') {
    return NextResponse.json({ error: 'This match already has a score recorded' }, { status: 400 })
  }

  const { data: profile } = await admin.from('profiles').select('role').eq('id', session.user.id).single()
  const isStaff = profile?.role === 'staff' || profile?.role === 'admin'

  const playerRowIds = [match.team1_player1_id, match.team1_player2_id, match.team2_player1_id, match.team2_player2_id]
  if (!isStaff) {
    const { data: participant } = await admin
      .from('tournament_players')
      .select('id')
      .in('id', playerRowIds)
      .eq('player_id', session.user.id)
      .maybeSingle()
    if (!participant) {
      return NextResponse.json({ error: 'Only players in this match (or staff) can submit its score' }, { status: 403 })
    }
  }

  const { error: updateError } = await admin
    .from('tournament_matches')
    .update({ team1_score: team1Score, team2_score: team2Score, status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', matchId)
    .eq('status', 'pending')

  if (updateError) {
    return NextResponse.json({ error: 'Could not save score — please try again' }, { status: 500 })
  }

  const team1Won = team1Score > team2Score
  const team2Won = team2Score > team1Score
  const updates: { id: string; points: number; won: boolean }[] = [
    { id: match.team1_player1_id, points: team1Score, won: team1Won },
    { id: match.team1_player2_id, points: team1Score, won: team1Won },
    { id: match.team2_player1_id, points: team2Score, won: team2Won },
    { id: match.team2_player2_id, points: team2Score, won: team2Won },
  ]
  for (const u of updates) {
    await admin.rpc('increment_tournament_player_stats', {
      p_tournament_player_id: u.id,
      p_points: u.points,
      p_won: u.won,
    })
  }

  return NextResponse.json({ success: true })
}
