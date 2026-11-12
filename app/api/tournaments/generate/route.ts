import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { loadTeamCaller } from '@/lib/team-server'
import { generateForCaller } from '@/lib/tournament-server'

// Make the next set of matches: the next Americano/Mexicano round, the whole round-robin draw,
// the group draw, the knockout once the groups are done, or the next knockout round.
export async function POST(request: Request) {
  const caller = await loadTeamCaller()
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const b = await request.json().catch(() => ({}))
  if (typeof b.tournamentId !== 'string') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  const result = await generateForCaller(createAdminClient(), caller, b.tournamentId)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json(result)
}
