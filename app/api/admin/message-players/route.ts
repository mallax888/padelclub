import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { loadTeamCaller } from '@/lib/team-server'
import { covers } from '@/lib/team'
import { VENUES } from '@/lib/venues'
import { validateAnnouncement } from '@/lib/announcements'
import { sendAnnouncement } from '@/lib/announcements-server'
import { loadClubPlayers } from '@/lib/club-players-server'
import { SEGMENTS, filterPlayers, type Segment } from '@/lib/club-players'

// An owner messages a group of their club's players (or one player) from the Players page. The group is worked out here from the
// club's own data, never taken from the browser, so nobody outside the club can be messaged and a stale list cannot be used.
export async function POST(request: Request) {
  const caller = await loadTeamCaller()
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (caller.role !== 'admin') return NextResponse.json({ error: 'Only an owner can message players.' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  const slug = typeof body?.venueSlug === 'string' && VENUES.some(v => v.slug === body.venueSlug) ? (body.venueSlug as string) : null
  if (!slug) return NextResponse.json({ error: 'Unknown club.' }, { status: 400 })
  if (!covers(caller.reach, { kind: 'club', venueSlug: slug })) return NextResponse.json({ error: 'That club is outside your reach.' }, { status: 403 })
  const segment = SEGMENTS.some(s => s.key === body?.segment) ? (body.segment as Segment) : null
  const playerId = typeof body?.playerId === 'string' ? body.playerId : null
  if (!segment && !playerId) return NextResponse.json({ error: 'Choose who to message.' }, { status: 400 })
  // A group message only goes out on a notification or email; it never lands on everyone's Home screen.
  const v = validateAnnouncement({ title: body?.title, body: body?.body, push: body?.push, email: body?.email, home: false })
  if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 })

  const admin = createAdminClient() as any
  const { today, players } = await loadClubPlayers(admin, slug)
  const people = playerId ? players.filter(p => p.id === playerId) : filterPlayers(players, segment!, today)
  const ids = people.map(p => p.id).filter(id => id !== caller.id)
  if (ids.length === 0) return NextResponse.json({ error: 'There is nobody in that group to message.' }, { status: 400 })
  const result = await sendAnnouncement(admin, { ...v.value, home: false, venueSlug: slug, createdBy: caller.id }, Date.now(), ids)
  if (result.ok === false) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ ok: true, told: result.told, emailed: result.emailed })
}
