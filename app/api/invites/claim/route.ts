import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { sendPushToUser } from '@/lib/push'
import { claimInvite } from '@/lib/invites'

// The admin client, deliberately: the person claiming a seat is not on the
// booking yet, so row-level security gives them no right to read or change it.
// The token in the link is the credential, and claimInvite is where it is
// checked -- including that the seat is still free, the game hasn't started and
// the booking hasn't been cancelled.
export async function POST(request: Request) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const admin = createAdminClient()
  const result = await claimInvite(admin, session.user.id, body?.token)
  // 'error' in result, not !result.ok: this repo isn't compiled with
  // strictNullChecks, and without it TypeScript can't narrow on a boolean flag.
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

  const { record, alreadyJoined } = result

  // Tell the booker. Best effort: the seat is already theirs to give up, and a
  // failed notification isn't a reason to take it back. Skipped on a repeat
  // open of the link, so one friend joining is one notification.
  if (!alreadyJoined && record.organiserId) {
    const { data: me } = await admin
      .from('profiles')
      .select('nickname, full_name')
      .eq('id', session.user.id)
      .maybeSingle()
    const name = me?.nickname ?? me?.full_name?.split(' ')[0] ?? 'Your friend'
    const message = `${name} accepted your invite and joined ${record.booking.courtName ?? 'your court'}`
    const { error: notifyError } = await admin
      .from('notifications')
      .insert({ user_id: record.organiserId, type: 'invite_joined', message })
    if (notifyError) console.error('Could not notify', record.organiserId, 'of an accepted invite', notifyError)
    await sendPushToUser(admin, record.organiserId, { title: `${name} joined your game`, body: message, url: '/mybookings' })
  }

  // splitId so the join page can go straight to paying for the seat.
  return NextResponse.json({ ok: true, alreadyJoined, bookingId: record.bookingId, splitId: record.splitId })
}
