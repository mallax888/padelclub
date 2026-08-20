import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { sendPushToUser } from '@/lib/push'

// A booking is "due" once its start time falls inside this window from now.
// The window is wider than the cron interval (run every 15 min, see
// vercel.json) so a slightly-delayed run can't skip a booking entirely --
// reminder_sent_at still guarantees each booking only gets pushed once.
const WINDOW_START_MIN = 105
const WINDOW_END_MIN = 135

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    console.error('CRON_SECRET is not set on this deployment — booking reminders cannot run')
    return NextResponse.json({ error: 'Server misconfigured: CRON_SECRET is not set' }, { status: 500 })
  }
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date()
  const windowStart = new Date(now.getTime() + WINDOW_START_MIN * 60 * 1000)
  const windowEnd = new Date(now.getTime() + WINDOW_END_MIN * 60 * 1000)

  const { data: bookings, error } = await admin
    .from('bookings')
    .select('id, user_id, date, start_time, courts(name, type)')
    .eq('status', 'confirmed')
    .is('reminder_sent_at', null)
    .not('user_id', 'is', null)
    .gte('date', windowStart.toISOString().slice(0, 10))
    .lte('date', windowEnd.toISOString().slice(0, 10))

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const due = (bookings ?? []).filter(b => {
    const startsAt = new Date(`${b.date}T${b.start_time}`)
    return startsAt >= windowStart && startsAt <= windowEnd
  })

  for (const b of due) {
    const court = b.courts as any
    await sendPushToUser(admin, b.user_id!, {
      title: 'Court time in 2 hours',
      body: `${court?.name ?? 'Your court'}${court?.type ? ' — ' + court.type : ''} at ${b.start_time.slice(0, 5)}`,
      url: '/mybookings',
    })
    await admin.from('bookings').update({ reminder_sent_at: new Date().toISOString() }).eq('id', b.id)
  }

  return NextResponse.json({ remindersSent: due.length })
}
