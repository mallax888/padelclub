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

    const { splitId, courtName, date, time, invitedByName } = await request.json()
    const admin = createAdminClient()

    const { data: split } = await admin
      .from('booking_splits')
      .select('id, booking_id, user_id, status')
      .eq('id', splitId)
      .single()
    if (!split || !split.booking_id) {
      return NextResponse.json({ error: 'Split request not found' }, { status: 404 })
    }
    if (split.user_id !== session.user.id) {
      return NextResponse.json({ error: 'Not your split request' }, { status: 403 })
    }
    if (split.status !== 'pending') {
      return NextResponse.json({ error: 'This split has already been paid' }, { status: 400 })
    }

    const verified = await verifyAndCorrectBookingPrice(admin, split.booking_id)
    if (!verified) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }
    const { count } = await admin
      .from('booking_splits')
      .select('id', { count: 'exact', head: true })
      .eq('booking_id', split.booking_id)
    const totalShares = (count ?? 0) + 1 // +1 for the original booker
    // Round in cents, not dollars. Math.round(price / shares) on its own
    // rounded every share to a whole dollar, so a real share of $29.67 was
    // charged as $30.00 while the button in My bookings -- which reads the
    // row's own amount_nzd, set to the cent when the split was created --
    // still said $29.67. Every split whose share wasn't already a round
    // dollar was charged up to 50c off what the payer was shown, and the
    // shares no longer summed to the court fee, since the booker's own
    // checkout (app/api/create-checkout/route.ts) has always charged to the
    // cent. Both sides now compute the share the same way.
    //
    // Shares that don't divide evenly can still leave a sub-cent residue
    // against the court fee (a $100 court split 3 ways collects $99.99);
    // that's the standard cost of equal shares and is off by orders of
    // magnitude less than the dollar rounding it replaces.
    const shareCents = Math.round((verified.verifiedPrice / totalShares) * 100)
    const shareAmount = shareCents / 100
    // Keep the row's own amount in sync with what's actually being charged.
    await admin.from('booking_splits').update({ amount_nzd: shareAmount }).eq('id', splitId)

    const { data: booking } = await admin.from('bookings').select('court_id').eq('id', split.booking_id).single()
    const { data: court } = booking ? await admin.from('courts').select('venue_slug').eq('id', booking.court_id).single() : { data: null }
    const region = court?.venue_slug ? getVenue(court.venue_slug).region : undefined
    const currency = currencyForRegion(region)

    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: `Court split — ${courtName}`,
              description: `${date} · ${time} · Requested by ${invitedByName}`,
            },
            unit_amount: shareCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${getAppUrl(request)}/mybookings?split=paid`,
      cancel_url: `${getAppUrl(request)}/mybookings?split=cancelled`,
      metadata: {
        splitId,
        userId: session.user.id,
        type: 'split_payment',
      },
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
