import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { currencyForRegion } from '@/lib/currency'
import { getVenue } from '@/lib/venues'
import { getAppUrl } from '@/lib/env'
import { formatDate } from '@/lib/utils'
import { coverQuote, shareDeadlineReady } from '@/lib/shares'
import { timezoneForVenueSlug, venueInstant } from '@/lib/timezone'

// The booker pays what their friends haven't, so the court is safe. Only the
// booker, only while the booking holds its court, and the amount is worked out
// here from the shares still unpaid, never taken from the browser.
export async function POST(request: Request) {
  try {
    const supabase = createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    if (typeof body?.bookingId !== 'string') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })

    const admin = createAdminClient()
    if (!(await shareDeadlineReady(admin))) return NextResponse.json({ error: "Covering shares isn't switched on yet." }, { status: 503 })
    const quote = await coverQuote(admin, body.bookingId)
    if (!quote) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    const b = quote.booking
    if (b.user_id !== session.user.id) return NextResponse.json({ error: 'Only the person who booked can cover shares.' }, { status: 403 })
    if (b.status !== 'confirmed') return NextResponse.json({ error: 'This booking is no longer held.' }, { status: 400 })
    if (venueInstant(b.date, `${String(b.start_time).slice(0, 5)}:00`, timezoneForVenueSlug(quote.venueSlug)).getTime() <= Date.now()) {
      return NextResponse.json({ error: 'That time has already started.' }, { status: 400 })
    }
    if (quote.splitIds.length === 0 || quote.cents <= 0) return NextResponse.json({ error: 'Everything is already paid.' }, { status: 400 })

    const region = quote.venueSlug ? getVenue(quote.venueSlug).region : undefined
    const checkout = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: currencyForRegion(region),
          product_data: {
            name: `Cover unpaid ${quote.splitIds.length === 1 ? 'share' : 'shares'} — ${b.courts?.name ?? 'Court'}`,
            description: `${formatDate(b.date)} · ${String(b.start_time).slice(0, 5)} · ${quote.splitIds.length} unpaid ${quote.splitIds.length === 1 ? 'share' : 'shares'}`,
          },
          unit_amount: quote.cents,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${getAppUrl(request)}/mybookings?cover=paid`,
      cancel_url: `${getAppUrl(request)}/mybookings?cover=cancelled`,
      metadata: {
        type: 'cover_shares',
        bookingId: body.bookingId,
        userId: session.user.id,
        splitIds: quote.splitIds.join(','),
        perShareCents: String(Math.round(quote.perShareCents)),
      },
    })
    return NextResponse.json({ url: checkout.url, cents: quote.cents, shares: quote.splitIds.length })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
