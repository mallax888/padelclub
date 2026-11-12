import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { loadTeamCaller } from '@/lib/team-server'
import { changeRoster } from '@/lib/tournament-server'

// Add or remove a player (or a guest without an account). Removing is refused once they are in a match.
export async function POST(request: Request) {
  const caller = await loadTeamCaller()
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const b = await request.json().catch(() => ({}))
  if (typeof b.tournamentId !== 'string' || (b.action !== 'add' && b.action !== 'remove')) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  const result = await changeRoster(createAdminClient(), caller, {
    tournamentId: b.tournamentId, action: b.action,
    playerId: typeof b.playerId === 'string' ? b.playerId : undefined, guestName: typeof b.guestName === 'string' ? b.guestName : undefined, rowId: typeof b.rowId === 'string' ? b.rowId : undefined,
  })
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ ok: true })
}
