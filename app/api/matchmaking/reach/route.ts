import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { VENUES, getVenue } from '@/lib/venues'
import { MAX_RATING, MIN_RATING } from '@/lib/matchmaking'

// How many players near a club are inside a level range, so someone starting a
// game can see who it will reach. A count only: no names, no ratings. "Near" is
// players whose home club is in the same region as the club the game is at.
export async function GET(request: Request) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const url = new URL(request.url)
  const venue = url.searchParams.get('venue') ?? ''
  const okRange = (min: number, max: number) => Number.isFinite(min) && Number.isFinite(max) && min <= max && min >= 0 && max <= MAX_RATING + 0.0001 && max >= MIN_RATING - 5
  if (!VENUES.some(v => v.slug === venue)) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })

  // One range (min and max), or several at once (ranges=2:3,1:4.5,...) so the level picker can show
  // how many players each quick choice and each level reaches in a single request.
  const ranges = url.searchParams.has('ranges')
    ? (url.searchParams.get('ranges') ?? '').split(',').map(p => p.split(':').map(Number) as [number, number])
    : [[Number(url.searchParams.get('min')), Number(url.searchParams.get('max'))] as [number, number]]
  if (ranges.length === 0 || ranges.length > 12 || !ranges.every(([a, b]) => okRange(a, b))) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })

  const region = getVenue(venue).region
  const slugs = VENUES.filter(v => v.region === region).map(v => v.slug)
  const admin: any = createAdminClient()
  const counts: number[] = []
  for (const [min, max] of ranges) {
    const { count, error } = await admin.from('profiles').select('id', { count: 'exact', head: true })
      .in('home_venue_slug', slugs).gte('skill_rating', min).lte('skill_rating', max).neq('id', session.user.id)
    if (error) return NextResponse.json({ error: 'Could not count players.' }, { status: 500 })
    counts.push(count ?? 0)
  }
  return NextResponse.json({ count: counts[0], counts }, { headers: { 'Cache-Control': 'no-store' } })
}
