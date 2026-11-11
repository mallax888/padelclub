import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { localDateStr } from '@/lib/utils'
import { hoursUntilBooking } from '@/lib/timezone'
import { notifyWaitlistForSlot } from '@/lib/waitlist'

export async function POST(request: Request) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { bookingId, newDate, newStartTime } = await request.json()
  if (!bookingId || !newDate || !newStartTime) {
    return NextResponse.json({ error: 'Missing bookingId, newDate or newStartTime' }, { status: 400 })
  }
  if (newDate < localDateStr()) {
    return NextResponse.json({ error: 'Pick a date that has not already passed.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: booking } = await admin
    .from('bookings')
    .select('id, court_id, date, start_time, duration_minutes, status, user_id, courts(name, type, venue_slug)')
    .eq('id', bookingId)
    .eq('user_id', session.user.id)
    .maybeSingle()

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }
  if (booking.status !== 'confirmed') {
    return NextResponse.json({ error: 'Only confirmed bookings can be rescheduled.' }, { status: 400 })
  }

  // Against the court's own clock, not the server's -- read as UTC this sat
  // twelve hours out for NZ, letting reschedules through inside the very
  // window the check exists to close.
  const hoursUntil = hoursUntilBooking(
    booking.date,
    booking.start_time,
    (booking.courts as any)?.venue_slug,
  )
  if (hoursUntil < 24) {
    return NextResponse.json({ error: 'Reschedule is only available more than 24 hours before your booking.' }, { status: 400 })
  }

  const [h, m] = newStartTime.split(':').map(Number)
  const startTotal = h * 60 + m
  const endTotal = startTotal + booking.duration_minutes
  const newEndTime = `${String(Math.floor(endTotal / 60)).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}:00`

  const { data: updated, error } = await admin
    .from('bookings')
    .update({ date: newDate, start_time: `${newStartTime}:00`, end_time: newEndTime })
    .eq('id', bookingId)
    .eq('user_id', session.user.id)
    .select('id')
    .maybeSingle()

  if (error) {
    if (error.code === '23P01') {
      return NextResponse.json({ error: 'That slot is no longer available — pick another time.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Could not reschedule — please try again.' }, { status: 500 })
  }
  if (!updated) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  // The time they left is free again: tell anyone waiting for it.
  await notifyWaitlistForSlot(admin, {
    courtId: booking.court_id, date: booking.date, startTime: booking.start_time, durationMinutes: booking.duration_minutes,
  })

  const { data: splits } = await admin
    .from('booking_splits')
    .select('user_id')
    .eq('booking_id', bookingId)
    .in('status', ['pending', 'paid'])

  // An invite seat is a share nobody has taken yet (user_id is null), so there
  // is no one to tell. Left in, it put a row with no recipient into the same
  // insert as everyone else's, and a database that refuses one such row refuses
  // the whole batch -- nobody on a real seat would have been told the court moved.
  const notifiable = (splits ?? []).filter(s => s.user_id)
  if (notifiable.length > 0) {
    const court = booking.courts as any
    const message = `Your padel booking (${court?.name ?? 'court'}) moved to ${newDate} at ${newStartTime}`
    await admin.from('notifications').insert(
      notifiable.map(s => ({ user_id: s.user_id, type: 'booking_rescheduled', message }))
    )
  }

  return NextResponse.json({ success: true, newDate, newStartTime })
}
