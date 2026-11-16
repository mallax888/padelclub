import { NextResponse } from 'next/server'
import { createCheckout, paymentTarget } from '@/lib/club-payments'
import { createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { verifyAndCorrectBookingPrice } from '@/lib/booking-price'
import { currencyForRegion, formatPrice } from '@/lib/currency'
import { getVenue } from '@/lib/venues'
import { getAppUrl } from '@/lib/env'
import { prepayReady } from '@/lib/regulars'
import { timezoneForVenueSlug, venueInstant } from '@/lib/timezone'
import { encodeParts, MAX_PREPAY_WEEKS, prepayTotalCents, weekCents, weeksPhrase, type PrepayWeek } from '@/lib/regular-pay'

// One card payment for every week of a regular that is still to be paid: this
// week and the held weeks after it. Each week's own slice is recorded when the
// payment lands (see the Stripe webhook), so a skipped week gives back just its
// slice. Where friends split a week, the booker's slice is their share of it.
export async function POST(request: Request) {
  try {
    const supabase = createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    const { regularId } = await request.json().catch(() => ({}))
    if (typeof regularId !== 'string') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })

    const admin = createAdminClient() as any
    if (!(await prepayReady(admin))) return NextResponse.json({ error: "Paying ahead isn't switched on yet." }, { status: 503 })
    const { data: series } = await admin.from('regulars').select('id, user_id, venue_slug, status').eq('id', regularId).maybeSingle()
    if (!series || series.user_id !== session.user.id) return NextResponse.json({ error: 'We could not find that regular.' }, { status: 404 })
    if (series.status !== 'active') return NextResponse.json({ error: 'This regular has been stopped.' }, { status: 400 })

    const tz = timezoneForVenueSlug(series.venue_slug)
    const { data: rows } = await admin.from('bookings')
      .select('id, date, start_time, status, stripe_payment_id, courts(name)')
      .eq('regular_id', regularId).eq('user_id', session.user.id).eq('status', 'confirmed')
      .order('date', { ascending: true })
    const due = ((rows ?? []) as any[])
      .filter(b => !b.stripe_payment_id && venueInstant(b.date, `${String(b.start_time).slice(0, 5)}:00`, tz).getTime() > Date.now())
      .slice(0, MAX_PREPAY_WEEKS)
    if (due.length === 0) return NextResponse.json({ error: 'Every week of this regular is already paid.' }, { status: 400 })

    const weeks: (PrepayWeek & { court: string })[] = []
    for (const b of due) {
      const verified = await verifyAndCorrectBookingPrice(admin, b.id)
      if (!verified) continue
      const { count } = await admin.from('booking_splits').select('id', { count: 'exact', head: true }).eq('booking_id', b.id)
      weeks.push({ bookingId: b.id, date: b.date, cents: weekCents(verified.verifiedPrice, count ?? 0), court: b.courts?.name ?? 'Court' })
    }
    if (weeks.length === 0) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

    const currency = currencyForRegion(getVenue(series.venue_slug).region)
    const total = prepayTotalCents(weeks)
    const target = await paymentTarget(admin, series.venue_slug, total)
    const checkout = await createCheckout({
      payment_method_types: ['card'],
      line_items: weeks.map(w => ({
        price_data: { currency, product_data: { name: `${w.court} — ${w.date}`, description: 'Weekly regular, paid in advance' }, unit_amount: w.cents },
        quantity: 1,
      })),
      mode: 'payment',
      success_url: `${getAppUrl(request)}/mybookings?payment=success`,
      cancel_url: `${getAppUrl(request)}/mybookings?payment=cancelled`,
      metadata: { type: 'regular_prepay', regularId, userId: session.user.id, weeks: String(weeks.length), ...encodeParts(weeks) },
    }, target)
    return NextResponse.json({ url: checkout.url, weeks: weeks.length, total: formatPrice(total / 100, currency), phrase: weeksPhrase(weeks.length) })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
