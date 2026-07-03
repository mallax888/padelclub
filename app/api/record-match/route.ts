import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

const POINTS = { win: 10, loss: 2, win_bonus: 5 }

export async function POST(request: Request) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { team1p1, team1p2, team2p1, team2p2, sets, matchWinner, notes } = await request.json()
  if (!team1p1 || !team2p1 || !matchWinner) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const admin = createAdminClient() as any
  const w1 = sets.filter((s: any) => s.t1 > s.t2).length
  const w2 = sets.filter((s: any) => s.t2 > s.t1).length
  const scoreText = sets.map((s: any) => `${s.t1}-${s.t2}`).join(' ')

  const { error: insertError } = await admin.from('matches').insert({
    player1_id: team1p1,
    player2_id: team2p1,
    winner_id: matchWinner === 1 ? team1p1 : team2p1,
    team1_player1_id: team1p1 || null,
    team1_player2_id: team1p2 || null,
    team2_player1_id: team2p1 || null,
    team2_player2_id: team2p2 || null,
    team1_sets: w1,
    team2_sets: w2,
    winner_team: matchWinner,
    score: scoreText,
    notes: notes || null,
    recorded_by: session.user.id,
    played_at: new Date().toISOString(),
  })

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  const winBonus = sets.length === 2 ? POINTS.win_bonus : 0
  const winners = (matchWinner === 1 ? [team1p1, team1p2] : [team2p1, team2p2]).filter(Boolean)
  const losers = (matchWinner === 1 ? [team2p1, team2p2] : [team1p1, team1p2]).filter(Boolean)

  for (const id of winners) {
    const { data: p } = await admin.from('profiles').select('wins, ranking_points').eq('id', id).single()
    await admin.from('profiles').update({
      wins: (p?.wins ?? 0) + 1,
      ranking_points: (p?.ranking_points ?? 0) + POINTS.win + winBonus,
    }).eq('id', id)
  }
  for (const id of losers) {
    const { data: p } = await admin.from('profiles').select('losses, ranking_points').eq('id', id).single()
    await admin.from('profiles').update({
      losses: (p?.losses ?? 0) + 1,
      ranking_points: (p?.ranking_points ?? 0) + POINTS.loss,
    }).eq('id', id)
  }

  return NextResponse.json({ success: true })
}
