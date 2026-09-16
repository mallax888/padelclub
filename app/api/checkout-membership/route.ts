import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServerClient } from '@/lib/supabase-server'
import { MEMBERSHIP_CONFIG, type MembershipTier } from '@/types/database'
import { getAppUrl } from '@/lib/env'
import { currencyForVenueSlug, localPriceFromNzd, formatPrice } from '@/lib/currency'

export async function POST(request: Request) {
  try {
    const supabase = createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    const { tier } = await request.json()
    const config = MEMBERSHIP_CONFIG[tier as MembershipTier]
    if (!config || config.priceNzd <= 0) {
      return NextResponse.json({ error: 'Invalid membership tier' }, { status: 400 })
    }

    // Charged in the member's own currency at that country's price -- see
    // localPriceFromNzd. home_venue_slug is set during onboarding; a member
    // who skipped that step has none and falls back to NZD.
    const { data: profile } = await supabase
      .from('profiles')
      .select('home_venue_slug')
      .eq('id', session.user.id)
      .single()
    const currency = currencyForVenueSlug(profile?.home_venue_slug)
    const localPrice = localPriceFromNzd(config.priceNzd, currency)
    const allowance = localPriceFromNzd(config.monthlyFreeSessionsNzd, currency)

    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: `${config.name} membership`,
              // The allowance is spent on court fees, which are already in
              // this member's currency, so it converts too. Quoting a bare
              // "$40" to a Johannesburg member for what arrives as R400 of
              // credit undersells it tenfold.
              description: `1 month · ${Math.round(config.discount * 100)}% off bookings, ${formatPrice(allowance, currency)} monthly credit allowance`,
            },
            unit_amount: Math.round(localPrice * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${getAppUrl(request)}/membership?payment=success`,
      cancel_url: `${getAppUrl(request)}/membership?payment=cancelled`,
      metadata: {
        type: 'membership',
        tier: config.id,
        userId: session.user.id,
      },
    })
    return NextResponse.json({ url: checkoutSession.url })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
