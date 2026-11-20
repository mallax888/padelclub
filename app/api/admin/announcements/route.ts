import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { loadTeamCaller } from '@/lib/team-server'
import { covers } from '@/lib/team'
import { VENUES } from '@/lib/venues'
import { validateAnnouncement } from '@/lib/announcements'
import { announcementAudience, loadRecent, sendAnnouncement } from '@/lib/announcements-server'

const venueFrom = (slug: unknown): string | null => (typeof slug === 'string' && VENUES.some(v => v.slug === slug) ? slug : null)

// What the owner sees in the message box: how many players a message would reach, and what was sent lately.
export async function GET(request: Request) {
  const caller = await loadTeamCaller()
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (caller.role !== 'admin') return NextResponse.json({ error: 'Only an owner can message players.' }, { status: 403 })
  const slug = venueFrom(new URL(request.url).searchParams.get('venue'))
  if (!slug) return NextResponse.json({ error: 'Unknown club.' }, { status: 400 })
  if (!covers(caller.reach, { kind: 'club', venueSlug: slug })) return NextResponse.json({ error: 'That club is outside your reach.' }, { status: 403 })
  const admin = createAdminClient() as any
  const [audience, recent] = await Promise.all([announcementAudience(admin, slug), loadRecent(admin, slug)])
  return NextResponse.json({ reach: audience.filter(id => id !== caller.id).length, available: recent.available, recent: recent.rows })
}

// Send a message to a club's players.
export async function POST(request: Request) {
  const caller = await loadTeamCaller()
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (caller.role !== 'admin') return NextResponse.json({ error: 'Only an owner can message players.' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  const slug = venueFrom(body?.venueSlug)
  if (!slug) return NextResponse.json({ error: 'Unknown club.' }, { status: 400 })
  if (!covers(caller.reach, { kind: 'club', venueSlug: slug })) return NextResponse.json({ error: 'That club is outside your reach.' }, { status: 403 })
  const v = validateAnnouncement(body)
  if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 })
  const result = await sendAnnouncement(createAdminClient() as any, { ...v.value, venueSlug: slug, createdBy: caller.id })
  if (result.ok === false) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ ok: true, told: result.told, emailed: result.emailed })
}
