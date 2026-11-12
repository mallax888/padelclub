import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { loadTeamCaller } from '@/lib/team-server'
import { covers } from '@/lib/team'
import { VENUES } from '@/lib/venues'
import { savePlan } from '@/lib/club-plans'

// Create or edit one of a club's membership plans. Owners only, and only for clubs
// inside their own reach. Everything is checked again here; the browser is not trusted.
export async function POST(request: Request) {
  const caller = await loadTeamCaller()
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (caller.role !== 'admin') return NextResponse.json({ error: 'Only an owner can change membership plans.' }, { status: 403 })

  const b = await request.json().catch(() => ({}))
  if (typeof b?.venueSlug !== 'string' || !VENUES.some(v => v.slug === b.venueSlug)) return NextResponse.json({ error: 'Unknown club.' }, { status: 400 })
  if (!covers(caller.reach, { kind: 'club', venueSlug: b.venueSlug })) return NextResponse.json({ error: 'That club is outside your reach.' }, { status: 403 })
  if (b.key !== undefined && b.key !== null && typeof b.key !== 'string') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  if (typeof b.name !== 'string' || typeof b.price !== 'number' || typeof b.discountPercent !== 'number' || typeof b.windowDays !== 'number' || !Array.isArray(b.perks) || typeof b.active !== 'boolean') {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const result = await savePlan(createAdminClient(), {
    venueSlug: b.venueSlug, key: b.key ?? null, name: b.name, price: b.price, discountPercent: b.discountPercent,
    windowDays: b.windowDays, perks: b.perks, active: b.active,
  })
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ ok: true, key: result.key })
}
