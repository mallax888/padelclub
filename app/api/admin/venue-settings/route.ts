import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { loadTeamCaller } from '@/lib/team-server'
import { covers } from '@/lib/team'
import { VENUES } from '@/lib/venues'
import { validateWeek } from '@/lib/venue-hours'
import { isMissingTable } from '@/lib/venue-settings'

// Save a club's opening hours and/or switch it on for booking. Owners only, and
// only for clubs inside their own reach. Written with the service role after the
// caller has been checked: the table has no write policy on purpose.
export async function POST(request: Request) {
  const caller = await loadTeamCaller()
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (caller.role !== 'admin') return NextResponse.json({ error: 'Only an owner can change club settings.' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const slug = body?.venueSlug
  if (typeof slug !== 'string' || !VENUES.some(v => v.slug === slug)) return NextResponse.json({ error: 'Unknown club.' }, { status: 400 })
  if (!covers(caller.reach, { kind: 'club', venueSlug: slug })) return NextResponse.json({ error: 'That club is outside your reach.' }, { status: 403 })

  const wantsHours = body.hours !== undefined
  const wantsOpen = body.isOpen !== undefined
  if (!wantsHours && !wantsOpen) return NextResponse.json({ error: 'Nothing to save.' }, { status: 400 })
  let hours: unknown = undefined
  if (wantsHours) {
    const v = validateWeek(body.hours)
    if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 })
    hours = v.hours
  }
  if (wantsOpen && typeof body.isOpen !== 'boolean') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })

  // types/database.ts lags the migrations, so this table isn't in it yet.
  const admin: any = createAdminClient()
  const { count: courtCount } = await admin.from('courts').select('id', { count: 'exact', head: true }).eq('venue_slug', slug).eq('is_active', true)
  // A club can't be opened to players with nothing to book.
  if (body.isOpen === true && (courtCount ?? 0) === 0) {
    return NextResponse.json({ error: 'Add at least one court before opening for booking.' }, { status: 400 })
  }

  const unavailable = NextResponse.json({ error: "Club setup isn't switched on yet. Run the 025 database change first." }, { status: 503 })
  const { data: existing, error: readError } = await admin.from('venue_settings').select('venue_slug').eq('venue_slug', slug).maybeSingle()
  if (isMissingTable(readError)) return unavailable
  if (readError) return NextResponse.json({ error: 'Could not save. Please try again.' }, { status: 500 })

  let error: any = null
  if (existing) {
    const update: any = { updated_at: new Date().toISOString() }
    if (wantsHours) update.hours = hours
    if (wantsOpen) update.is_open_for_booking = body.isOpen
    ;({ error } = await admin.from('venue_settings').update(update).eq('venue_slug', slug))
  } else {
    // First time this club is set up. A club that already has courts is already
    // live (no row used to mean open), so saving its hours must not close it; a
    // brand-new club starts closed until its owner opens it.
    ;({ error } = await admin.from('venue_settings').insert({
      venue_slug: slug,
      is_open_for_booking: wantsOpen ? body.isOpen : (courtCount ?? 0) > 0,
      hours: wantsHours ? hours : null,
    }))
  }
  if (isMissingTable(error)) return unavailable
  if (error) {
    console.error('Could not save venue settings', slug, error)
    return NextResponse.json({ error: 'Could not save. Please try again.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
