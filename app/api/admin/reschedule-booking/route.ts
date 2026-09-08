import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { localDateStr } from '@/lib/utils'

// Staff-side counterpart to /api/reschedule-booking: that route is
// member-facing, locked to the booking's own owner and a 24-hour notice
// window (a policy that exists to stop last-minute member changes, not one
// that should block a manager rearranging their own board). This route has
// neither restriction, but only moves the date -- the Admin board's month
// view only has day-sized drop targets, not a specific time slot, so the
// booking keeps its original start/end time and just moves to the new day.
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

  const { bookingId, newDate } = await request.json()
  if (!bookingId || !newDate) {
    return NextResponse.json({ error: 'Missing bookingId or newDate' }, { status: 400 })
  }
  if (newDate < localDateStr()) {
    return NextResponse.json({ error: 'Pick a date that has not already passed.' }, { status: 400 })
  }

  // Using the caller's own session client (not the service-role admin
  // client) means "Staff can manage all bookings" (see
  // 017_country_scoped_staff.sql) enforces the caller's own venue/country
  // scoping here, same as the admin cancel route.
  const { data: updated, error } = await supabase
    .from('bookings')
    .update({ date: newDate })
    .eq('id', bookingId)
    .neq('status', 'cancelled')
    .select('id')
    .maybeSingle()

  if (error) {
    if (error.code === '23P01' || error.code === '23505') {
      return NextResponse.json({ error: 'That date already has a clashing booking on this court.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Could not reschedule — please try again.' }, { status: 500 })
  }
  if (!updated) {
    return NextResponse.json({ error: 'Booking not found, already cancelled, or outside your venue' }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
