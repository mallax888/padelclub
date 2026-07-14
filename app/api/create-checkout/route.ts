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
    const { bookingId, courtName, date, time, amount, splitCount, region } = await request.json()
    const currency = currencyForRegion(region)
    const unitAmount = Math.round((amount / splitCount) * 100) // convert to cents
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: `${courtName} \u2014 ${date}`,
              description: `${time} \u00b7 Split between ${splitCount} players`,
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/mybookings?payment=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/book?payment=cancelled`,
      metadata: {
        bookingId,
        userId: session.user.id,
        splitCount: String(splitCount),
      },
    })
    return NextResponse.json({ url: checkoutSession.url })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
