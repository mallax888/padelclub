import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { applyCancellationRefund } from '@/lib/cancellation'

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
    .select('id, user_id, court_id, date, start_time, price_nzd, stripe_payment_id, payment_method')
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

  // The booker never paid, but their friends may well have: a split invite
  // goes out the moment the booking is created, and someone can pay their
  // share inside the 20-minute hold. Releasing the slot without giving that
  // money back left the club holding it for a court nobody plays on.
  //
  // applyCancellationRefund is the one place that knows how to unwind a
  // booking's money, and it does the right thing here without special-casing:
  // the booker's own branch is skipped (stripe_payment_id is null -- that's
  // what makes the booking stale in the first place), paid shares are
  // refunded to the card, and unpaid requests are withdrawn so they can't be
  // paid against a released court.
  let sharesRefunded = 0
  for (const booking of staleBookings) {
    try {
      const result = await applyCancellationRefund(supabase, booking, { byStaff: true })
      sharesRefunded += result.splitsRefunded
      if (result.refundFailed) {
        console.error('Refund failed while releasing stale booking', booking.id)
      }
    } catch (err) {
      // One booking's refund blowing up shouldn't strand the rest -- the
      // slots are already released, which is this cron's main job.
      console.error('Could not unwind payments for released booking', booking.id, err)
    }
  }
  const { error: matchError } = await supabase.from('open_matches').update({ status: 'cancelled' }).in('booking_id', bookingIds).eq('status', 'open')
  if (matchError) {
    console.error('Failed to cancel open_matches for released bookings:', matchError)
  }

  return NextResponse.json({
    released: cancelled?.length ?? 0,
    sharesRefunded,
    bookingIds: (cancelled ?? []).map(b => b.id),
  })
}
