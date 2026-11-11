import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { loadTeamCaller } from '@/lib/team-server'
import { covers } from '@/lib/team'
import { VENUES } from '@/lib/venues'
import { tableMissing } from '@/lib/regulars'

// A club's rules for weekly regulars: whether they are allowed, and the most
// courts regulars may hold at one peak time. Owners only, inside their own reach.
export async function POST(request: Request) {
  const caller = await loadTeamCaller()
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (caller.role !== 'admin') return NextResponse.json({ error: 'Only an owner can change club settings.' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const slug = body?.venueSlug
  if (typeof slug !== 'string' || !VENUES.some(v => v.slug === slug)) return NextResponse.json({ error: 'Unknown club.' }, { status: 400 })
  if (!covers(caller.reach, { kind: 'club', venueSlug: slug })) return NextResponse.json({ error: 'That club is outside your reach.' }, { status: 403 })

  const wantsEnabled = body.enabled !== undefined
  const wantsCap = body.peakCap !== undefined
  if (!wantsEnabled && !wantsCap) return NextResponse.json({ error: 'Nothing to save.' }, { status: 400 })
  if (wantsEnabled && typeof body.enabled !== 'boolean') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  if (wantsCap && !(body.peakCap === null || (Number.isInteger(body.peakCap) && body.peakCap >= 0 && body.peakCap <= 50))) {
    return NextResponse.json({ error: 'Enter a whole number of courts, or leave it blank for no limit.' }, { status: 400 })
  }

  const admin: any = createAdminClient()
  const unavailable = NextResponse.json({ error: "Regulars aren't switched on yet. Run the 027 database change first." }, { status: 503 })
  const { data: existing, error: readError } = await admin.from('regular_settings').select('venue_slug').eq('venue_slug', slug).maybeSingle()
  if (tableMissing(readError)) return unavailable
  if (readError) return NextResponse.json({ error: 'Could not save. Please try again.' }, { status: 500 })

  const fields: any = { updated_at: new Date().toISOString() }
  if (wantsEnabled) fields.enabled = body.enabled
  if (wantsCap) fields.peak_court_cap = body.peakCap
  const { error } = existing
    ? await admin.from('regular_settings').update(fields).eq('venue_slug', slug)
    : await admin.from('regular_settings').insert({ venue_slug: slug, ...fields })
  if (tableMissing(error)) return unavailable
  if (error) {
    console.error('Could not save regular settings', slug, error)
    return NextResponse.json({ error: 'Could not save. Please try again.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
