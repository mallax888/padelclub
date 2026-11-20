import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { loadTeamCaller } from '@/lib/team-server'
import { covers } from '@/lib/team'

// Take a notice off players' Home screens now (the bell messages already sent stay where they are).
export async function POST(request: Request) {
  const caller = await loadTeamCaller()
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (caller.role !== 'admin') return NextResponse.json({ error: 'Only an owner can do this.' }, { status: 403 })
  const b = await request.json().catch(() => ({}))
  if (typeof b?.id !== 'string') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  const admin = createAdminClient() as any
  const { data: row, error } = await admin.from('club_announcements').select('id, venue_slug').eq('id', b.id).maybeSingle()
  if (error || !row) return NextResponse.json({ error: 'We could not find that message.' }, { status: 404 })
  if (!covers(caller.reach, { kind: 'club', venueSlug: row.venue_slug })) return NextResponse.json({ error: 'That message is outside your reach.' }, { status: 403 })
  await admin.from('club_announcements').update({ expires_at: new Date().toISOString() }).eq('id', row.id)
  return NextResponse.json({ ok: true })
}
