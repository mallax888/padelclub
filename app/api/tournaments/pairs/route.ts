import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { loadTeamCaller } from '@/lib/team-server'
import { makeTournamentPairs } from '@/lib/tournament-server'

// Make the partnerships for a pair format: a random draw, balanced by level, picked by hand, or cleared.
export async function POST(request: Request) {
  const caller = await loadTeamCaller()
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const b = await request.json().catch(() => ({}))
  if (typeof b.tournamentId !== 'string' || !['random', 'balanced', 'manual', 'clear'].includes(b.mode)) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  const result = await makeTournamentPairs(createAdminClient(), caller, {
    tournamentId: b.tournamentId, mode: b.mode,
    pairs: Array.isArray(b.pairs) ? b.pairs.map((p: unknown) => (Array.isArray(p) ? p.filter((x: unknown) => typeof x === 'string') : [])) : undefined,
  })
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ ok: true, pairs: result.pairs })
}
