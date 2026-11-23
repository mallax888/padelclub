import { gameHasEnded } from '@/lib/game-over'
import { fmtClock } from '@/lib/clock'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { loadTeamCaller } from '@/lib/team-server'
import { covers } from '@/lib/team'
import { sendPushToUser } from '@/lib/push'
import { formatPrice, currencyForVenueSlug } from '@/lib/currency'
import { formatDate } from '@/lib/utils'
import { getAppUrl } from '@/lib/env'

// "Remind both": the club nudges the friend who owes a share and the organiser who
// booked, in one tap. Owner only (it sits next to the money). A push plus a bell
// message each; it never changes the booking or the share.
export async function POST(request: Request) {
  const caller = await loadTeamCaller()
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (caller.role !== 'admin') return NextResponse.json({ error: 'Only an owner can send reminders.' }, { status: 403 })
  const b = await request.json().catch(() => ({}))
  if (typeof b?.id !== 'string') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })

  const admin = createAdminClient() as any
  const { data: split } = await admin.from('booking_splits')
    .select('id, user_id, invited_by, amount_nzd, status, bookings(date, start_time, end_time, status, courts(name, venue_slug))')
    .eq('id', b.id).maybeSingle()
  if (!split) return NextResponse.json({ error: 'We could not find that share.' }, { status: 404 })
  const venueSlug: string | undefined = split.bookings?.courts?.venue_slug
  if (!venueSlug || !covers(caller.reach, { kind: 'club', venueSlug })) return NextResponse.json({ error: 'That club is outside your reach.' }, { status: 403 })
  if (split.status !== 'pending' || !split.user_id || split.bookings?.status === 'cancelled' || (split.bookings?.date && gameHasEnded(split.bookings.date, split.bookings.end_time ?? split.bookings.start_time, venueSlug, Date.now()))) {
    return NextResponse.json({ error: 'That share is no longer owed, so there is nothing to remind.' }, { status: 409 })
  }

  const court = split.bookings?.courts?.name ?? 'the court'
  const date = formatDate(split.bookings.date)
  const time = fmtClock(String(split.bookings.start_time))
  const amount = formatPrice(Number(split.amount_nzd) || 0, currencyForVenueSlug(venueSlug))
  const url = `${getAppUrl(request)}/my-bookings`

  const { data: people } = await admin.from('profiles').select('id, full_name, nickname').in('id', [split.user_id, split.invited_by].filter(Boolean))
  const first = (id: string | null) => { const p = (people ?? []).find((x: any) => x.id === id); return p?.nickname ?? p?.full_name?.split(' ')[0] ?? 'A player' }

  const messages: { to: string; title: string; body: string }[] = [
    { to: split.user_id, title: 'Your share is overdue', body: `Your share of ${amount} for ${court} on ${date} at ${time} is overdue. Please pay it today.` },
  ]
  if (split.invited_by && split.invited_by !== split.user_id) {
    messages.push({ to: split.invited_by, title: 'A share on your booking is overdue', body: `${first(split.user_id)} hasn't paid ${amount} for ${court} on ${date} at ${time}. You can nudge them or cover it.` })
  }
  for (const m of messages) {
    await sendPushToUser(admin, m.to, { title: m.title, body: m.body, url })
    const { error } = await admin.from('notifications').insert({ user_id: m.to, type: 'split_reminder', message: m.body })
    if (error) console.error('Could not write an overdue-share reminder to the bell for', m.to, error)
  }
  return NextResponse.json({ ok: true, told: messages.length })
}
