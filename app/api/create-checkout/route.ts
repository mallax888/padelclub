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
    const { bookingId, courtName, date, time, splitCount } = await request.json()
    // Only these two values are ever legitimate (see BookingFlow.tsx) -- clamp
    // anything else instead of trusting a client-supplied divisor.
    const safeSplitCount = splitCount === 4 ? 4 : 1

    const admin = createAdminClient()
    const verified = await verifyAndCorrectBookingPrice(admin, bookingId)
    if (!verified) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }
    if (verified.userId !== session.user.id) {
      return NextResponse.json({ error: 'Not your booking' }, { status: 403 })
    }

    const { data: booking } = await admin.from('bookings').select('court_id').eq('id', bookingId).single()
    const { data: court } = booking ? await admin.from('courts').select('venue_slug').eq('id', booking.court_id).single() : { data: null }
    const region = court?.venue_slug ? getVenue(court.venue_slug).region : undefined
    const currency = currencyForRegion(region)

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
