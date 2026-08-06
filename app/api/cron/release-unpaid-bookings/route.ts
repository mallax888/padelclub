import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

const HOLD_MINUTES = 20

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    // Distinct from a bad caller: this deployment was never given the
    // secret, so every cron trigger would otherwise silently 401 forever
    // with nothing in the logs pointing at why.
    console.error('CRON_SECRET is not set on this deployment — the cleanup cron cannot run')
    return NextResponse.json({ error: 'Server misconfigured: CRON_SECRET is not set' }, { status: 500 })
  }
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

  const { data: cancelled, error: cancelError } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .in('id', bookingIds)
    .select('id')
  if (cancelError) {
    console.error('Failed to release stale bookings:', cancelError)
    return NextResponse.json({ error: cancelError.message }, { status: 500 })
  }

  // Delete rather than set a status here — booking_splits' valid status
  // values aren't enforced in the TS types, so a status we can't confirm the
  // DB accepts risks erroring; deleting the now-moot pending request doesn't.
  const { error: splitsError } = await supabase.from('booking_splits').delete().in('booking_id', bookingIds).eq('status', 'pending')
  if (splitsError) {
    console.error('Failed to clean up booking_splits for released bookings:', splitsError)
  }
  const { error: matchError } = await supabase.from('open_matches').update({ status: 'cancelled' }).in('booking_id', bookingIds).eq('status', 'open')
  if (matchError) {
    console.error('Failed to cancel open_matches for released bookings:', matchError)
  }

  return NextResponse.json({ released: cancelled?.length ?? 0, bookingIds: (cancelled ?? []).map(b => b.id) })
}
