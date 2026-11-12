import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { loadTeamCaller } from '@/lib/team-server'
import { covers } from '@/lib/team'
import { VENUES } from '@/lib/venues'
import { createOffer } from '@/lib/offers'

// Send a "fill my empty courts" offer: discount a window of hours at one club and
// tell past players. Owners only, and only for clubs inside their own reach.
export async function POST(request: Request) {
  const caller = await loadTeamCaller()
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (caller.role !== 'admin') return NextResponse.json({ error: 'Only an owner can send offers.' }, { status: 403 })

  const b = await request.json().catch(() => ({}))
  if (typeof b?.venueSlug !== 'string' || !VENUES.some(v => v.slug === b.venueSlug)) return NextResponse.json({ error: 'Unknown club.' }, { status: 400 })
  if (!covers(caller.reach, { kind: 'club', venueSlug: b.venueSlug })) return NextResponse.json({ error: 'That club is outside your reach.' }, { status: 403 })
  if (typeof b.date !== 'string' || typeof b.startTime !== 'string' || typeof b.endTime !== 'string' || !Number.isInteger(b.percent)) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })

  const result = await createOffer(createAdminClient(), {
    venueSlug: b.venueSlug, date: b.date, startTime: b.startTime.slice(0, 5), endTime: b.endTime.slice(0, 5), percent: b.percent,
    audience: typeof b.audience === 'string' ? b.audience : 'past_players', createdBy: caller.id,
  })
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ ok: true, id: result.offer.id, told: result.told })
}
