import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServerClient } from '@/lib/supabase-server'
import { currencyForRegion } from '@/lib/currency'

export async function POST(request: Request) {
  try {
    const supabase = createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { splitId, amount, courtName, date, time, invitedByName, region } = await request.json()
    const currency = currencyForRegion(region)

    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: `Court split \u2014 ${courtName}`,
              description: `${date} \u00b7 ${time} \u00b7 Requested by ${invitedByName}`,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/mybookings?split=paid`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/mybookings?split=cancelled`,
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
