import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { loadTeamCaller } from '@/lib/team-server'
import { isPlatformAdmin, newInviteToken, inviteExpiry } from '@/lib/club-access'
import { emailHasAccount, escapeHtml, joinLink, sendClubEmail } from '@/lib/club-server'
import { VENUES } from '@/lib/venues'

// The platform admin approves or declines a "Start a club" request. Approving creates a
// one-time invite for the first owner of that club, emailed as a set-password link.
export async function POST(request: Request) {
  const caller = await loadTeamCaller()
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!isPlatformAdmin(caller)) return NextResponse.json({ error: 'Only the platform admin can decide club requests.' }, { status: 403 })

  const b = await request.json().catch(() => ({}))
  if (typeof b?.id !== 'string' || !['approve', 'decline'].includes(b?.action)) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })

  const admin = createAdminClient() as any
  const { data: req } = await admin.from('club_requests').select('*').eq('id', b.id).maybeSingle()
  if (!req) return NextResponse.json({ error: 'We could not find that request.' }, { status: 404 })
  if (req.status !== 'pending') return NextResponse.json({ error: `That request was already ${req.status}.` }, { status: 409 })

  if (b.action === 'decline') {
    const reason = typeof b.reason === 'string' ? b.reason.trim().slice(0, 300) : ''
    const { error } = await admin.from('club_requests').update({ status: 'declined', decline_reason: reason || null, decided_by: caller.id, decided_at: new Date().toISOString() }).eq('id', req.id)
    if (error) return NextResponse.json({ error: 'Could not save that. Please try again.' }, { status: 500 })
    await sendClubEmail({
      to: req.email, subject: 'Your PadelClub request', heading: 'About your club request',
      intro: `Hi ${escapeHtml(req.contact_name)}, thanks for asking to start <b>${escapeHtml(req.club_name)}</b>. We are not able to set it up right now.${reason ? ` ${escapeHtml(reason)}` : ''}`,
      footer: 'You are welcome to reply to this email or try again later.',
    })
    return NextResponse.json({ ok: true })
  }

  // Approve: the club has to be one the app knows (the club list is fixed in code for now).
  const venue = VENUES.find(v => v.slug === b.venueSlug)
  if (!venue) return NextResponse.json({ error: 'Choose which club this is in the list. If it is not there yet, it has to be added first.' }, { status: 400 })
  if (await emailHasAccount(admin, req.email)) {
    return NextResponse.json({ error: 'That email already has a PadelClub account (probably a player). Ask them for a different work email, then decline this and have them send it again.' }, { status: 409 })
  }

  const { token, hash } = newInviteToken()
  const { error: inviteError } = await admin.from('team_invites').insert({
    created_at: new Date().toISOString(), token_hash: hash, email: req.email, role: 'admin', managed_venue_slug: venue.slug, managed_country: null,
    invited_by: caller.id, request_id: req.id, expires_at: inviteExpiry(Date.now()),
  })
  if (inviteError) { console.error('Could not create the owner invite', inviteError); return NextResponse.json({ error: 'Could not save that. Please try again.' }, { status: 500 }) }
  const { error } = await admin.from('club_requests').update({ status: 'approved', venue_slug: venue.slug, decided_by: caller.id, decided_at: new Date().toISOString() }).eq('id', req.id)
  if (error) return NextResponse.json({ error: 'Could not save that. Please try again.' }, { status: 500 })

  const link = joinLink(request, token)
  const emailed = await sendClubEmail({
    to: req.email, subject: `${req.club_name} is approved on PadelClub`, heading: 'Your club is approved',
    intro: `Hi ${escapeHtml(req.contact_name)}, <b>${escapeHtml(req.club_name)}</b> is approved. Set a password to open your club dashboard.`,
    ctaText: 'Set my password', ctaUrl: link, footer: 'This link works once and expires in 7 days. If you did not ask for this, ignore this email.',
  })
  return NextResponse.json({ ok: true, emailed, link })
}
