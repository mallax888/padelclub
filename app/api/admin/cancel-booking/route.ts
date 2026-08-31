import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { applyCancellationRefund } from '@/lib/cancellation'

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

  const { bookingId } = await request.json()

  // Using the caller's own session client (not the service-role admin
  // client) for this update means "Staff can manage all bookings" (see
  // 017_country_scoped_staff.sql) enforces the caller's own venue/country
  // scoping right here -- a manager scoped to one venue or country simply
  // matches zero rows for a booking outside it, exactly as if they'd tried
  // the same update from the Supabase dashboard. No need to re-derive that
  // scoping logic in this route.
  const { data: booking } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)
    .neq('status', 'cancelled')
    .select('id, user_id, date, start_time, price_nzd, stripe_payment_id, payment_method')
    .maybeSingle()

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found, already cancelled, or outside your venue' }, { status: 400 })
  }

  // The refund itself needs the service-role client (crediting another
  // user's balance and calling Stripe aren't things RLS lets a staff
  // session do directly).
  const admin = createAdminClient()
  const result = await applyCancellationRefund(admin, booking)
  return NextResponse.json({ success: true, ...result })
}
