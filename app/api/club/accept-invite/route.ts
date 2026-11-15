import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { validPassword } from '@/lib/club-access'
import { emailHasAccount, lookupInvite } from '@/lib/club-server'

// Public (the one-time link is the proof): creates the club account from an invite.
// The role and club come from the invite row, never from this request.
const WHY: Record<string, string> = {
  used: 'This invite was already used. If that was you, log in from the club log-in page.',
  cancelled: 'This invite was cancelled. Ask the owner to send you a new one.',
  expired: 'This invite has expired. Ask the owner to send you a new one.',
  missing: 'We could not find that invite. Check the link in your email.',
}

export async function POST(request: Request) {
  const b = await request.json().catch(() => ({}))
  if (!validPassword(b?.password)) return NextResponse.json({ error: 'Choose a password of at least 8 characters.' }, { status: 400 })
  const fullName = String(b?.fullName ?? '').replace(/\s+/g, ' ').trim().slice(0, 80)
  const admin = createAdminClient() as any

  const { state, invite } = await lookupInvite(admin, b?.token)
  if (state !== 'ok') return NextResponse.json({ error: WHY[state] }, { status: 410 })
  if (await emailHasAccount(admin, invite.email)) return NextResponse.json({ error: 'That email already has an account. Log in from the club log-in page.' }, { status: 409 })

  // Claim the invite first so two clicks cannot create two accounts.
  const { data: claimed } = await admin.from('team_invites').update({ used_at: new Date().toISOString() }).eq('id', invite.id).is('used_at', null).is('cancelled_at', null).select('id')
  if (!claimed || claimed.length === 0) return NextResponse.json({ error: WHY.used }, { status: 410 })

  const { data: created, error } = await admin.auth.admin.createUser({
    email: invite.email, password: b.password, email_confirm: true, user_metadata: { full_name: fullName || null },
  })
  const userId = created?.user?.id as string | undefined
  if (error || !userId) {
    await admin.from('team_invites').update({ used_at: null }).eq('id', invite.id)
    console.error('Could not create a club account from an invite', error)
    return NextResponse.json({ error: 'Could not create your account. Please try again, or ask for a new invite.' }, { status: 500 })
  }
  const { error: profileError } = await admin.from('profiles').upsert({
    id: userId, email: invite.email, full_name: fullName || null, role: invite.role,
    managed_venue_slug: invite.managed_venue_slug, managed_country: invite.managed_country, onboarding_completed: true,
  }, { onConflict: 'id' })
  if (profileError) {
    console.error('Could not set up the club profile', profileError)
    return NextResponse.json({ error: 'Your account was created but not finished. Ask the owner to check the team list.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, email: invite.email })
}
