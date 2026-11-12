import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { loadTeamCaller } from '@/lib/team-server'
import { covers } from '@/lib/team'
import { memberHomeClub, setMemberPlan } from '@/lib/club-plans'

// Give a member a plan for free until a date, or put them back on Casual. Owners
// only, and only for members whose home club is inside the owner's reach.
export async function POST(request: Request) {
  const caller = await loadTeamCaller()
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (caller.role !== 'admin') return NextResponse.json({ error: 'Only an owner can change a member’s plan.' }, { status: 403 })
  const b = await request.json().catch(() => ({}))
  if (typeof b?.userId !== 'string' || typeof b.planKey !== 'string' || (b.endsOn != null && typeof b.endsOn !== 'string')) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  const admin = createAdminClient()
  const home = await memberHomeClub(admin, b.userId)
  if (home === undefined) return NextResponse.json({ error: 'We could not find that member.' }, { status: 404 })
  if (home !== null && !covers(caller.reach, { kind: 'club', venueSlug: home })) return NextResponse.json({ error: 'That member is outside your reach.' }, { status: 403 })
  const result = await setMemberPlan(admin, { userId: b.userId, planKey: b.planKey, endsOn: b.endsOn ?? null, grantedBy: caller.id })
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ ok: true, planName: result.planName })
}
