import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { loadTeamCaller } from '@/lib/team-server'
import { createTournament } from '@/lib/tournament-server'

// Set up a tournament. Club staff only, and only at the clubs they look after.
export async function POST(request: Request) {
  const caller = await loadTeamCaller()
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const b = await request.json().catch(() => ({}))
  const result = await createTournament(createAdminClient(), caller, {
    name: typeof b.name === 'string' ? b.name : '', format: typeof b.format === 'string' ? b.format : '', venueSlug: typeof b.venueSlug === 'string' ? b.venueSlug : '',
    date: typeof b.date === 'string' ? b.date : '', courtIds: Array.isArray(b.courtIds) ? b.courtIds.filter((x: unknown) => typeof x === 'string') : [],
    pointsToWin: b.pointsToWin, totalRounds: b.totalRounds, settings: b.settings,
    playerIds: Array.isArray(b.playerIds) ? b.playerIds.filter((x: unknown) => typeof x === 'string') : [],
    guestNames: Array.isArray(b.guestNames) ? b.guestNames.filter((x: unknown) => typeof x === 'string') : [],
  })
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ ok: true, id: result.id })
}
