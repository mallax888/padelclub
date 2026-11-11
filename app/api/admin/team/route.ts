import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { loadTeamCaller } from '@/lib/team-server'
import { planTeamChange, scopeOf, type TeamAction } from '@/lib/team'

// Add, change or remove a member of the team. The rules live in lib/team.ts
// (planTeamChange) so they can be tested on their own; this route only
// identifies the caller, loads the person being changed, and applies the plan.
export async function POST(request: Request) {
  const caller = await loadTeamCaller()
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const action = body?.action as TeamAction
  if (!['add', 'update', 'remove'].includes(action) || typeof body?.userId !== 'string') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: row } = await admin
    .from('profiles')
    .select('id, role, managed_venue_slug, managed_country')
    .eq('id', body.userId)
    .maybeSingle()
  const target = row ? { id: (row as any).id as string, role: (row as any).role as string, scope: scopeOf(row as any) } : null

  const { count: otherOwners } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'admin')
    .neq('id', body.userId)

  const plan = planTeamChange({
    action,
    caller: { id: caller.id, role: caller.role, reach: caller.reach },
    target,
    role: body.role,
    scope: body.scope,
    otherOwners: otherOwners ?? 0,
  })
  // 'error' in plan, not !plan.ok: this repo isn't compiled with strictNullChecks,
  // so TypeScript can't narrow on a boolean flag.
  if ('error' in plan) return NextResponse.json({ error: plan.error }, { status: plan.status })

  const { error } = await admin.from('profiles').update(plan.update).eq('id', body.userId)
  if (error) {
    console.error('Could not update team member', body.userId, error)
    return NextResponse.json({ error: 'Could not save that change. Please try again.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
