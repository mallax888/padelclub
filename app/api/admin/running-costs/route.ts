import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { loadTeamCaller } from '@/lib/team-server'
import { covers } from '@/lib/team'
import { VENUES } from '@/lib/venues'
import { validateCosts } from '@/lib/running-costs'

// A club's running costs and the on/off switch for the breakeven line. Owners only, inside their reach.
export async function POST(request: Request) {
  const caller = await loadTeamCaller()
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (caller.role !== 'admin') return NextResponse.json({ error: 'Only an owner can change club settings.' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  const slug = body?.venueSlug
  if (typeof slug !== 'string' || !VENUES.some(v => v.slug === slug)) return NextResponse.json({ error: 'Unknown club.' }, { status: 400 })
  if (!covers(caller.reach, { kind: 'club', venueSlug: slug })) return NextResponse.json({ error: 'That club is outside your reach.' }, { status: 403 })
  const v = validateCosts(body)
  if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 })

  const admin = createAdminClient() as any
  const fields: any = { updated_at: new Date().toISOString() }
  if (v.value.monthly !== undefined) fields.monthly_cost = v.value.monthly
  if (v.value.show !== undefined) fields.show_line = v.value.show
  const unavailable = NextResponse.json({ error: "Running costs aren't switched on yet. Run the 042 database change first." }, { status: 503 })
  const { data: existing, error: readError } = await admin.from('club_running_costs').select('venue_slug').eq('venue_slug', slug).maybeSingle()
  if (readError) return unavailable
  const { error } = existing
    ? await admin.from('club_running_costs').update(fields).eq('venue_slug', slug)
    : await admin.from('club_running_costs').insert({ venue_slug: slug, ...fields })
  if (error) return NextResponse.json({ error: 'Could not save. Please try again.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
