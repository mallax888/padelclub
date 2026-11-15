import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { loadTeamCaller } from '@/lib/team-server'
import { covers, scopeOf } from '@/lib/team'

// Cancel an invite that has not been used yet.
export async function POST(request: Request) {
  const caller = await loadTeamCaller()
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (caller.role !== 'admin') return NextResponse.json({ error: 'Only an owner can manage the team.' }, { status: 403 })
  const b = await request.json().catch(() => ({}))
  if (typeof b?.id !== 'string') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  const admin = createAdminClient() as any
  const { data: inv } = await admin.from('team_invites').select('id, managed_venue_slug, managed_country, used_at, cancelled_at').eq('id', b.id).maybeSingle()
  if (!inv) return NextResponse.json({ error: 'We could not find that invite.' }, { status: 404 })
  if (!covers(caller.reach, scopeOf(inv))) return NextResponse.json({ error: 'That invite is outside your reach.' }, { status: 403 })
  if (inv.used_at) return NextResponse.json({ error: 'That invite was already used.' }, { status: 409 })
  if (!inv.cancelled_at) await admin.from('team_invites').update({ cancelled_at: new Date().toISOString() }).eq('id', inv.id)
  return NextResponse.json({ ok: true })
}
