import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { loadTeamCaller } from '@/lib/team-server'
import { covers } from '@/lib/team'
import { isLiveClub } from '@/lib/club-link'
import { contactsAvailable } from '@/lib/contacts-server'

// The checks every import route starts with: signed in, an owner, a real club inside their reach, and the database change run.
export async function ownerGuard(body: any): Promise<{ ok: true; caller: NonNullable<Awaited<ReturnType<typeof loadTeamCaller>>>; slug: string; admin: any } | { ok: false; res: NextResponse }> {
  const caller = await loadTeamCaller()
  if (!caller) return { ok: false, res: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) }
  if (caller.role !== 'admin') return { ok: false, res: NextResponse.json({ error: 'Only an owner can import players.' }, { status: 403 }) }
  const slug = typeof body?.venueSlug === 'string' && isLiveClub(body.venueSlug) ? (body.venueSlug as string) : null
  if (!slug) return { ok: false, res: NextResponse.json({ error: 'Unknown club.' }, { status: 400 }) }
  if (!covers(caller.reach, { kind: 'club', venueSlug: slug })) return { ok: false, res: NextResponse.json({ error: 'That club is outside your reach.' }, { status: 403 }) }
  const admin = createAdminClient() as any
  if (!(await contactsAvailable(admin))) return { ok: false, res: NextResponse.json({ error: 'Player import is not switched on yet. The database change needs to be run first.' }, { status: 503 }) }
  return { ok: true, caller, slug, admin }
}
