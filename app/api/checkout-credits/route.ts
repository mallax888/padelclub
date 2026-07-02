import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServerClient } from '@/lib/supabase-server'

export async function POST(request: Request) {
  try {
    const supabase = createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    const { packId, sessions, priceNzd } = await request.json()
    const unitAmount = Math.round(priceNzd * 100) // convert to cents

    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'nzd',
            product_data: {
              name: `${sessions}-session credit pack`,
              description: 'PadelClub session credits — use any time, on any court',
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/membership?payment=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/membership?payment=cancelled`,
      metadata: {
        type: 'credit_pack',
        packId,
        sessions: String(sessions),
        userId: session.user.id,
      },
    })
    return NextResponse.json({ url: checkoutSession.url })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
