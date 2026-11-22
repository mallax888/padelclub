import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { loadTeamCaller } from '@/lib/team-server'
import { inviteExpiry, newInviteToken } from '@/lib/club-access'
import { escapeHtml, joinLink, sendClubEmail } from '@/lib/club-server'
import { covers, scopeLabel, scopeOf } from '@/lib/team'
import { roleLabel } from '@/lib/view-mode'

// Send an invite that is still waiting again (they lost the email, or it went to spam). The link in the
// first email stops working and a fresh one, good for another 7 days, goes out in its place. With
// `email: false` nothing is emailed: the new link just comes back so the owner can send it themselves
// (WhatsApp, text) -- the link of an invite is only ever known at the moment it is made.
export async function POST(request: Request) {
  const caller = await loadTeamCaller()
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (caller.role !== 'admin') return NextResponse.json({ error: 'Only an owner can manage the team.' }, { status: 403 })
  const b = await request.json().catch(() => ({}))
  if (typeof b?.id !== 'string') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  const admin = createAdminClient() as any
  const { data: inv } = await admin.from('team_invites').select('id, email, role, managed_venue_slug, managed_country, used_at, cancelled_at').eq('id', b.id).maybeSingle()
  if (!inv) return NextResponse.json({ error: 'We could not find that invite.' }, { status: 404 })
  if (!covers(caller.reach, scopeOf(inv))) return NextResponse.json({ error: 'That invite is outside your reach.' }, { status: 403 })
  if (inv.used_at) return NextResponse.json({ error: 'They have already joined.' }, { status: 409 })
  if (inv.cancelled_at) return NextResponse.json({ error: 'That invite was cancelled. Send a new one instead.' }, { status: 409 })

  const { token, hash } = newInviteToken()
  const { error } = await admin.from('team_invites').insert({
    created_at: new Date().toISOString(), token_hash: hash, email: inv.email, role: inv.role, managed_venue_slug: inv.managed_venue_slug ?? null, managed_country: inv.managed_country ?? null,
    invited_by: caller.id, expires_at: inviteExpiry(Date.now()),
  })
  if (error) { console.error('Could not resend a team invite', error); return NextResponse.json({ error: 'Could not send that again. Please try again.' }, { status: 500 }) }
  await admin.from('team_invites').update({ cancelled_at: new Date().toISOString() }).eq('id', inv.id)

  const link = joinLink(request, token)
  if (b?.email === false) return NextResponse.json({ ok: true, emailed: false, link })
  const where = scopeLabel(scopeOf(inv))
  const emailed = await sendClubEmail({
    to: inv.email, subject: `${caller.name ?? 'An owner'} invited you to PadelMate`, heading: 'You have been invited',
    intro: `${escapeHtml(caller.name ?? 'An owner')} invited you to join as <b>${roleLabel(inv.role)}</b> (${escapeHtml(where)}). Set a password to open the club dashboard.`,
    ctaText: 'Set my password', ctaUrl: link, footer: 'This link works once and expires in 7 days. If you do not know the person who invited you, ignore this email and nothing happens.',
  })
  return NextResponse.json({ ok: true, emailed, link })
}
