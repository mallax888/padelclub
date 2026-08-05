import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

const HOLD_MINUTES = 20

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const cutoff = new Date(Date.now() - HOLD_MINUTES * 60 * 1000).toISOString()

  // A booking is "confirmed" the instant it's created, before the user has
  // actually paid on the Stripe checkout page they're redirected to — that
  // holds the slot against double-booking while they pay. If stripe_payment_id
  // is still null this long after creation, they never completed checkout, so
  // release the slot rather than leave it permanently blocked and unpaid.
  const { data: staleBookings, error: findError } = await supabase
    .from('bookings')
    .select('id')
    .eq('status', 'confirmed')
    .eq('payment_method', 'card')
    .is('stripe_payment_id', null)
    .lt('created_at', cutoff)

  if (findError) {
    return NextResponse.json({ error: findError.message }, { status: 500 })
  }
  if (!staleBookings || staleBookings.length === 0) {
    return NextResponse.json({ released: 0 })
  }

  const bookingIds = staleBookings.map(b => b.id)

  await supabase.from('bookings').update({ status: 'cancelled' }).in('id', bookingIds)
  // Delete rather than set a status here — booking_splits' valid status
  // values aren't enforced in the TS types, so a status we can't confirm the
  // DB accepts risks erroring; deleting the now-moot pending request doesn't.
  await supabase.from('booking_splits').delete().in('booking_id', bookingIds).eq('status', 'pending')
  await supabase.from('open_matches').update({ status: 'cancelled' }).in('booking_id', bookingIds).eq('status', 'open')

  return NextResponse.json({ released: bookingIds.length, bookingIds })
}
