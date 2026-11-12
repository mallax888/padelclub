import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { loadTeamCaller } from '@/lib/team-server'
import { recordScore } from '@/lib/tournament-server'

// Record a match score: the players in the match, or the club team for that club.
// A knockout moves on by itself once a round is complete.
export async function POST(request: Request) {
  const caller = await loadTeamCaller()
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const b = await request.json().catch(() => ({}))
  if (typeof b.matchId !== 'string' || typeof b.team1Score !== 'number' || typeof b.team2Score !== 'number') {
    return NextResponse.json({ error: 'Missing matchId, team1Score or team2Score' }, { status: 400 })
  }
  const result = await recordScore(createAdminClient(), caller, { matchId: b.matchId, team1Score: b.team1Score, team2Score: b.team2Score })
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ success: true, finished: result.finished, message: result.message })
}
