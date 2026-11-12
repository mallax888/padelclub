import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { loadTeamCaller } from '@/lib/team-server'
import { covers } from '@/lib/team'
import { VENUES } from '@/lib/venues'
import { distanceKm, validCoords } from '@/lib/nearby'

// An owner puts their club on the map where it really is (they use their phone while
// standing at the club), or goes back to the address-based position. Owners only, for
// clubs in their own reach. A position far from where the club is listed is refused,
// which catches setting it from home by mistake.
const MAX_KM = 50, MAX_KM_CITY_ONLY = 80

export async function POST(request: Request) {
  const caller = await loadTeamCaller()
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (caller.role !== 'admin') return NextResponse.json({ error: 'Only an owner can set the club location.' }, { status: 403 })

  const b = await request.json().catch(() => ({}))
  const venue = VENUES.find(v => v.slug === b?.venueSlug)
  if (!venue) return NextResponse.json({ error: 'Unknown club.' }, { status: 400 })
  if (!covers(caller.reach, { kind: 'club', venueSlug: venue.slug })) return NextResponse.json({ error: 'That club is outside your reach.' }, { status: 403 })

  const clear = b.clear === true
  if (!clear && !validCoords(b.lat, b.lng)) return NextResponse.json({ error: "We couldn't read that location. Please try again." }, { status: 400 })
  if (!clear && venue.lat !== undefined && venue.lng !== undefined) {
    const km = distanceKm({ lat: b.lat, lng: b.lng }, { lat: venue.lat, lng: venue.lng })
    if (km > (venue.approx ? MAX_KM_CITY_ONLY : MAX_KM)) {
      return NextResponse.json({ error: `That's ${Math.round(km)} km from where ${venue.name} is listed. Stand at the club and try again.` }, { status: 400 })
    }
  }

  const admin: any = createAdminClient()
  const notReady = NextResponse.json({ error: "Map location isn't switched on yet. Run the 031 database change first." }, { status: 503 })
  const missing = (e: any) => !!e && (e.code === '42703' || e.code === '42P01' || e.code === 'PGRST204' || e.code === 'PGRST205' || /(does not exist|schema cache)/i.test(String(e.message ?? '')))
  const { data: existing, error: readError } = await admin.from('venue_settings').select('venue_slug').eq('venue_slug', venue.slug).maybeSingle()
  if (missing(readError)) return notReady
  if (readError) return NextResponse.json({ error: 'Could not save. Please try again.' }, { status: 500 })
  const fields = clear ? { lat: null, lng: null } : { lat: b.lat, lng: b.lng }

  let error: any = null
  if (existing) {
    ;({ error } = await admin.from('venue_settings').update({ ...fields, updated_at: new Date().toISOString() }).eq('venue_slug', venue.slug))
  } else if (!clear) {
    // First settings row for this club: a club that already has courts is already live, so
    // saving a location must not close it; a brand-new club stays closed until opened.
    const { count } = await admin.from('courts').select('id', { count: 'exact', head: true }).eq('venue_slug', venue.slug).eq('is_active', true)
    ;({ error } = await admin.from('venue_settings').insert({ venue_slug: venue.slug, is_open_for_booking: (count ?? 0) > 0, hours: null, ...fields }))
  }
  if (missing(error)) return notReady
  if (error) {
    console.error('Could not save venue location', venue.slug, error)
    return NextResponse.json({ error: 'Could not save. Please try again.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
