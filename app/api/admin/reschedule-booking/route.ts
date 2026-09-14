import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { localDateStr } from '@/lib/utils'

// Staff-side counterpart to /api/reschedule-booking: that route is
// member-facing, locked to the booking's own owner and a 24-hour notice
// window (a policy that exists to stop last-minute member changes, not one
// that should block a manager rearranging their own board). This route has
// neither restriction.
//
// Used by both the month view (drag to another day -- only newDate) and the
// day view (drag to another court/time cell -- newCourtId and/or
// newStartTime, same day). Whichever fields aren't provided keep the
// booking's current value; duration is always preserved, so only start_time
// moves and end_time is recomputed from it.
export async function POST(request: Request) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
  if (!profile || !['staff', 'admin'].includes((profile as any).role)) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const { bookingId, newDate, newCourtId, newStartTime } = await request.json()
  if (!bookingId || (!newDate && !newCourtId && !newStartTime)) {
    return NextResponse.json({ error: 'Missing bookingId and at least one of newDate/newCourtId/newStartTime' }, { status: 400 })
  }

  const { data: current } = await supabase
    .from('bookings')
    .select('date, court_id, start_time, duration_minutes')
    .eq('id', bookingId)
    .maybeSingle()
  if (!current) {
    return NextResponse.json({ error: 'Booking not found or outside your venue' }, { status: 404 })
  }

  const finalDate = newDate ?? current.date
  if (finalDate < localDateStr()) {
    return NextResponse.json({ error: 'Pick a date that has not already passed.' }, { status: 400 })
  }
  const finalCourtId = newCourtId ?? current.court_id
  const finalStartTime = newStartTime ? `${newStartTime.slice(0, 5)}:00` : current.start_time
  const [h, m] = finalStartTime.slice(0, 5).split(':').map(Number)
  const endTotal = h * 60 + m + current.duration_minutes
  const finalEndTime = `${String(Math.floor(endTotal / 60)).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}:00`

  // Using the caller's own session client (not the service-role admin
  // client) means "Staff can manage all bookings" (see
  // 017_country_scoped_staff.sql) enforces the caller's own venue/country
  // scoping here, same as the admin cancel route.
  const { data: updated, error } = await supabase
    .from('bookings')
    .update({ date: finalDate, court_id: finalCourtId, start_time: finalStartTime, end_time: finalEndTime })
    .eq('id', bookingId)
    .neq('status', 'cancelled')
    .select('id')
    .maybeSingle()

  if (error) {
    if (error.code === '23P01' || error.code === '23505') {
      return NextResponse.json({ error: 'That slot already has a clashing booking on this court.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Could not reschedule — please try again.' }, { status: 500 })
  }
  if (!updated) {
    return NextResponse.json({ error: 'Booking not found, already cancelled, or outside your venue' }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
