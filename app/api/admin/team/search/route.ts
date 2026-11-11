import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { loadTeamCaller } from '@/lib/team-server'
import { countryOfVenue, searchTerm } from '@/lib/team'

// Find a player to add to the team, by name or email. Owners only, and a club
// or country owner only finds players whose home club is inside their own reach.
export async function GET(request: Request) {
  const caller = await loadTeamCaller()
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (caller.role !== 'admin') return NextResponse.json({ error: 'Only an owner can manage the team.' }, { status: 403 })

  const q = searchTerm(new URL(request.url).searchParams.get('q') ?? '')
  if (q.length < 2) return NextResponse.json({ results: [] })

  const { data } = await createAdminClient()
    .from('profiles')
    .select('id, full_name, nickname, email, role, home_venue_slug')
    .or(`full_name.ilike.%${q}%,nickname.ilike.%${q}%,email.ilike.%${q}%`)
    .order('full_name')
    .limit(40)

  const { venueSlug, country } = caller.reach
  const inReach = (home: string | null) =>
    venueSlug ? home === venueSlug : country ? !!home && countryOfVenue(home) === country : true

  const results = ((data ?? []) as any[])
    .filter(p => inReach(p.home_venue_slug ?? null))
    .slice(0, 8)
    .map(p => ({ id: p.id as string, name: (p.nickname ?? p.full_name ?? 'Unnamed') as string, email: (p.email ?? '') as string, role: p.role as string, isMe: p.id === caller.id }))
  return NextResponse.json({ results })
}
