import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServerClient } from '@/lib/supabase-server'
import { MEMBERSHIP_CONFIG, type MembershipTier } from '@/types/database'
import { getAppUrl } from '@/lib/env'

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

    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'nzd',
            product_data: {
              name: `${config.name} membership`,
              description: `1 month · ${Math.round(config.discount * 100)}% off bookings, $${config.monthlyFreeSessionsNzd} monthly credit allowance`,
            },
            unit_amount: Math.round(config.priceNzd * 100),
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
