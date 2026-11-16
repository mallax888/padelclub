import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { loadTeamCaller } from '@/lib/team-server'
import { covers } from '@/lib/team'
import { VENUES } from '@/lib/venues'
import { validateBriefing } from '@/lib/briefing'

// A club's morning briefing settings: on or off, the time, and phone and email. Owners only, inside their reach.
export async function POST(request: Request) {
  const caller = await loadTeamCaller()
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (caller.role !== 'admin') return NextResponse.json({ error: 'Only an owner can change club settings.' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  const slug = body?.venueSlug
  if (typeof slug !== 'string' || !VENUES.some(v => v.slug === slug)) return NextResponse.json({ error: 'Unknown club.' }, { status: 400 })
  if (!covers(caller.reach, { kind: 'club', venueSlug: slug })) return NextResponse.json({ error: 'That club is outside your reach.' }, { status: 403 })
  const v = validateBriefing(body)
  if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 })

  const admin = createAdminClient() as any
  const fields: any = { updated_at: new Date().toISOString() }
  if (v.value.enabled !== undefined) fields.enabled = v.value.enabled
  if (v.value.hour !== undefined) fields.send_hour = v.value.hour
  if (v.value.push !== undefined) fields.by_push = v.value.push
  if (v.value.email !== undefined) fields.by_email = v.value.email
  const unavailable = NextResponse.json({ error: "The morning briefing isn't switched on yet. Run the 035 database change first." }, { status: 503 })
  const { data: existing, error: readError } = await admin.from('briefing_settings').select('venue_slug').eq('venue_slug', slug).maybeSingle()
  if (readError) return unavailable
  const { error } = existing
    ? await admin.from('briefing_settings').update(fields).eq('venue_slug', slug)
    : await admin.from('briefing_settings').insert({ venue_slug: slug, ...fields })
  if (error) return NextResponse.json({ error: 'Could not save. Please try again.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
