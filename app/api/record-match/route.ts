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

  const { team1p1, team1p2, team2p1, team2p2, sets, matchWinner, notes, idempotencyKey } = await request.json()
  if (!team1p1 || !team2p1 || !matchWinner) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  const admin = createAdminClient() as any

  const players = [team1p1, team1p2, team2p1, team2p2].filter(Boolean)
  if (!players.includes(session.user.id)) {
    const { data: recorder } = await admin.from('profiles').select('role').eq('id', session.user.id).single()
    if (!recorder || !['staff', 'admin'].includes(recorder.role)) {
      return NextResponse.json({ error: 'You can only record matches you played in' }, { status: 403 })
    }
  }

  const w1 = sets.filter((s: any) => s.t1 > s.t2).length
  const w2 = sets.filter((s: any) => s.t2 > s.t1).length
  const scoreText = sets.map((s: any) => `${s.t1}-${s.t2}`).join(' ')

  // idempotency_key is unique, so a double-submit (double click bypassing the
  // disabled state, or a retried request) is ignored by the DB instead of
  // inserting the match -- and awarding points -- twice.
  const { data: insertedRows, error: insertError } = await admin
    .from('matches')
    .upsert({
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
      idempotency_key: idempotencyKey ?? null,
    }, { onConflict: 'idempotency_key', ignoreDuplicates: true })
    .select('id')

  if (insertError) {
    console.error('Record match insert error:', insertError)
    return NextResponse.json({ error: 'Could not record match. Please try again.' }, { status: 500 })
  }
  if (idempotencyKey && (!insertedRows || insertedRows.length === 0)) {
    // Already recorded by an earlier delivery of this exact submission --
    // treat as success without re-applying points.
    return NextResponse.json({ success: true })
  }

  const winBonus = sets.length === 2 ? POINTS.win_bonus : 0
  const winners = (matchWinner === 1 ? [team1p1, team1p2] : [team2p1, team2p2]).filter(Boolean)
  const losers = (matchWinner === 1 ? [team2p1, team2p2] : [team1p1, team1p2]).filter(Boolean)

  // Atomic DB-side increments, not select-then-update -- two matches
  // recorded close together for the same player would otherwise race and
  // one increment could get silently lost.
  for (const id of winners) {
    await admin.rpc('record_match_result', { p_user_id: id, p_win: true, p_points: POINTS.win + winBonus })
  }
  for (const id of losers) {
    await admin.rpc('record_match_result', { p_user_id: id, p_win: false, p_points: POINTS.loss })
  }

  return NextResponse.json({ success: true })
}
