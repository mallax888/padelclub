import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { sendPushToUser } from '@/lib/push'
import { venueInstant, timezoneForVenueSlug } from '@/lib/timezone'

// The UTC calendar date `days` away from this instant, as 'YYYY-MM-DD'.
const isoDateOffset = (from: Date, days: number) =>
  new Date(from.getTime() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

// A booking is "due" once its start time falls inside this window from now.
// The window is wider than the trigger interval (run every 15 min via
// .github/workflows/booking-reminders.yml -- Vercel Hobby only allows daily
// cron, so GitHub Actions' scheduler is used instead) so a slightly-delayed
// run can't skip a booking entirely -- reminder_sent_at still guarantees
// each booking only gets pushed once.
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
    .select('id, user_id, date, start_time, courts(name, type, venue_slug)')
    .eq('status', 'confirmed')
    .is('reminder_sent_at', null)
    .not('user_id', 'is', null)
    // A day either side of the UTC window, because bookings.date is the
    // court's calendar date, which is already tomorrow in Auckland while it
    // is still today in UTC. Narrowing to the UTC date dropped exactly the
    // bookings this cron exists to remind about; the precise check below is
    // what actually decides, so casting wider here costs only a few rows.
    .gte('date', isoDateOffset(windowStart, -1))
    .lte('date', isoDateOffset(windowEnd, 1))

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const due = (bookings ?? []).filter(b => {
    // The court's wall clock, not the server's. Parsed as UTC, a 7pm
    // Auckland booking looked like 7pm UTC -- so the "in 2 hours" push went
    // out about ten hours after the game had finished.
    const startsAt = venueInstant(
      b.date,
      b.start_time,
      timezoneForVenueSlug((b.courts as any)?.venue_slug),
    )
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
