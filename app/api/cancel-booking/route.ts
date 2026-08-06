import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

export async function POST(request: Request) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { bookingId } = await request.json()
  const admin = createAdminClient()

  // .neq('status','cancelled') is the guard against double-crediting: a
  // second cancel request (double click, retry, two open tabs) finds no row
  // still in a cancellable state and matches nothing, instead of silently
  // re-running the credit-award branch below a second time.
  const { data: booking } = await admin
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)
    .eq('user_id', session.user.id)
    .neq('status', 'cancelled')
    .select('id, date, start_time, price_nzd, stripe_payment_id')
    .maybeSingle()

  if (!booking) {
    return NextResponse.json({ error: 'Booking already cancelled or not found' }, { status: 400 })
  }

  const isPaid = !!booking.stripe_payment_id
  const hoursUntil = (new Date(`${booking.date}T${booking.start_time}`).getTime() - Date.now()) / (1000 * 60 * 60)

  let creditAmount = 0
  if (isPaid && hoursUntil < 24) {
    creditAmount = Math.round(booking.price_nzd * 0.5)
    const { data: profile } = await admin.from('profiles').select('credits').eq('id', session.user.id).single()
    await admin.from('profiles').update({ credits: (profile?.credits ?? 0) + creditAmount }).eq('id', session.user.id)
  }

  return NextResponse.json({ success: true, isPaid, hoursUntil, creditAmount })
}
