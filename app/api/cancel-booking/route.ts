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

  const { bookingId } = await request.json()
  const admin = createAdminClient()

  // .neq('status','cancelled') is the guard against double-processing: a
  // second cancel request (double click, retry, two open tabs) finds no row
  // still in a cancellable state and matches nothing, instead of silently
  // re-running the refund/credit-award branches below a second time.
  const { data: booking } = await admin
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)
    .eq('user_id', session.user.id)
    .neq('status', 'cancelled')
    .select('id, user_id, date, start_time, price_nzd, stripe_payment_id, payment_method')
    .maybeSingle()

  if (!booking) {
    return NextResponse.json({ error: 'Booking already cancelled or not found' }, { status: 400 })
  }

  const result = await applyCancellationRefund(admin, booking)
  return NextResponse.json({ success: true, ...result })
}
