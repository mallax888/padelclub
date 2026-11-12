import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { loadTeamCaller } from '@/lib/team-server'
import { covers } from '@/lib/team'
import { endOffer } from '@/lib/offers'

// End an offer early. Players who already booked under it keep their price.
export async function POST(request: Request) {
  const caller = await loadTeamCaller()
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (caller.role !== 'admin') return NextResponse.json({ error: 'Only an owner can end offers.' }, { status: 403 })
  const b = await request.json().catch(() => ({}))
  if (typeof b?.id !== 'string') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  const admin = createAdminClient()
  const { data: offer } = await (admin as any).from('court_offers').select('venue_slug').eq('id', b.id).maybeSingle()
  if (!offer) return NextResponse.json({ error: 'We could not find that offer.' }, { status: 404 })
  if (!covers(caller.reach, { kind: 'club', venueSlug: offer.venue_slug })) return NextResponse.json({ error: 'That club is outside your reach.' }, { status: 403 })
  const result = await endOffer(admin, b.id)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ ok: true })
}
