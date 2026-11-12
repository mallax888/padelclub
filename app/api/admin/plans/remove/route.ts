import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { loadTeamCaller } from '@/lib/team-server'
import { covers } from '@/lib/team'
import { VENUES } from '@/lib/venues'
import { removePlan } from '@/lib/club-plans'

// Remove a plan the club made itself (once nobody is on it). Owners only.
export async function POST(request: Request) {
  const caller = await loadTeamCaller()
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (caller.role !== 'admin') return NextResponse.json({ error: 'Only an owner can change membership plans.' }, { status: 403 })
  const b = await request.json().catch(() => ({}))
  if (typeof b?.venueSlug !== 'string' || !VENUES.some(v => v.slug === b.venueSlug) || typeof b.key !== 'string') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  if (!covers(caller.reach, { kind: 'club', venueSlug: b.venueSlug })) return NextResponse.json({ error: 'That club is outside your reach.' }, { status: 403 })
  const result = await removePlan(createAdminClient(), b.venueSlug, b.key)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ ok: true })
}
