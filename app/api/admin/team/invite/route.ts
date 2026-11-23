import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { loadTeamCaller } from '@/lib/team-server'
import { inviteExpiry, newInviteToken, planInvite } from '@/lib/club-access'
import { MIGRATION_MESSAGE, emailHasAccount, escapeHtml, joinLink, sendClubEmail, tableMissing } from '@/lib/club-server'
import { scopeLabel, scopeOf } from '@/lib/team'
import { roleLabel } from '@/lib/view-mode'

// An owner invites a new team member by email. The invite is the only way to get a club
// account: the person sets a password from the emailed link and lands on the club dashboard.
export async function POST(request: Request) {
  const caller = await loadTeamCaller()
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const b = await request.json().catch(() => ({}))
  const admin = createAdminClient() as any

  const email = String(b?.email ?? '').trim().toLowerCase()
  const plan = planInvite({ caller: { role: caller.role, reach: caller.reach }, email, role: b?.role, scope: b?.scope, emailHasAccount: email ? await emailHasAccount(admin, email) : false })
  if ('error' in plan) return NextResponse.json({ error: plan.error }, { status: plan.status })

  const { token, hash } = newInviteToken()
  const { error } = await admin.from('team_invites').insert({
    created_at: new Date().toISOString(), token_hash: hash, email: plan.email, role: plan.role, ...plan.columns, invited_by: caller.id, expires_at: inviteExpiry(Date.now()),
  })
  if (error) {
    if (tableMissing(error)) return NextResponse.json({ error: MIGRATION_MESSAGE.replace("Starting a club", 'Inviting by email') }, { status: 503 })
    console.error('Could not create a team invite', error)
    return NextResponse.json({ error: 'Could not save that. Please try again.' }, { status: 500 })
  }

  const link = joinLink(request, token)
  const where = scopeLabel(scopeOf(plan.columns))
  const emailed = await sendClubEmail({
    to: plan.email, subject: `${caller.name ?? 'An owner'} invited you to PadelMate`, heading: 'You have been invited',
    intro: `${escapeHtml(caller.name ?? 'An owner')} invited you to join as <b>${roleLabel(plan.role)}</b> (${escapeHtml(where)}). Set a password to open the club dashboard.`,
    ctaText: 'Set my password', ctaUrl: link, footer: 'This link works once and expires in 7 days. If you do not know the person who invited you, ignore this email and nothing happens.',
  })
  return NextResponse.json({ ok: true, emailed, link })
}
