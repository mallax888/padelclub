import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { verifyAndCorrectBookingPrice } from '@/lib/booking-price'
import { currencyForRegion } from '@/lib/currency'
import { getVenue } from '@/lib/venues'
import { getAppUrl } from '@/lib/env'

export async function POST(request: Request) {
  try {
    const supabase = createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    const { bookingId, courtName, date, time } = await request.json()

    const admin = createAdminClient()
    const verified = await verifyAndCorrectBookingPrice(admin, bookingId)
    if (!verified) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }
    if (verified.userId !== session.user.id) {
      return NextResponse.json({ error: 'Not your booking' }, { status: 403 })
    }
    // Without this, a retried/duplicate request (stalled redirect, refresh
    // mid-flow, double submit) could open a second Checkout Session for a
    // booking that's already been paid, charging the card twice.
    if (verified.stripePaymentId) {
      return NextResponse.json({ error: 'This booking has already been paid for.' }, { status: 400 })
    }
    if (verified.status === 'cancelled') {
      return NextResponse.json({ error: 'This booking has been cancelled.' }, { status: 400 })
    }

    const { data: booking } = await admin.from('bookings').select('court_id').eq('id', bookingId).single()
    const { data: court } = booking ? await admin.from('courts').select('venue_slug').eq('id', booking.court_id).single() : { data: null }
    const region = court?.venue_slug ? getVenue(court.venue_slug).region : undefined
    const currency = currencyForRegion(region)

    // The number of shares the court fee is split into is derived from the
    // actual booking_splits rows already created for this booking, never
    // trusted from the client -- same principle as verifyAndCorrectBookingPrice
    // itself, and the same derivation pay-split already uses. Previously this
    // trusted a client-supplied splitCount, clamped only to "4 or 1" -- which
    // both allowed anyone to request a quarter-price charge with zero actual
    // split invitations behind it, and disagreed with what BookingFlow.tsx
    // showed the booker when 2 or 3 friends (not exactly 3) were invited.
    const { count: splitRowCount } = await admin
      .from('booking_splits')
      .select('id', { count: 'exact', head: true })
      .eq('booking_id', bookingId)
    const safeSplitCount = (splitRowCount ?? 0) + 1

    const unitAmount = Math.round((verified.verifiedPrice / safeSplitCount) * 100)
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: `${courtName} — ${date}`,
              description: `${time} · Split between ${safeSplitCount} players`,
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${getAppUrl(request)}/mybookings?payment=success`,
      cancel_url: `${getAppUrl(request)}/book?payment=cancelled`,
      metadata: {
        bookingId,
        userId: session.user.id,
        splitCount: String(safeSplitCount),
      },
    })
    return NextResponse.json({ url: checkoutSession.url })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
