import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServerClient } from '@/lib/supabase-server'
import { CREDIT_PACKS } from '@/lib/creditPacks'
import { getAppUrl } from '@/lib/env'

export async function POST(request: Request) {
  try {
    const supabase = createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    const { packId } = await request.json()
    const pack = CREDIT_PACKS.find(p => p.id === packId)
    if (!pack) {
      return NextResponse.json({ error: 'Unknown credit pack' }, { status: 400 })
    }
    const unitAmount = Math.round(pack.priceNzd * 100) // convert to cents

    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'nzd',
            product_data: {
              name: `${pack.sessions}-session credit pack`,
              description: 'PadelClub session credits — use any time, on any court',
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${getAppUrl(request)}/membership?payment=success`,
      cancel_url: `${getAppUrl(request)}/membership?payment=cancelled`,
      metadata: {
        type: 'credit_pack',
        packId: pack.id,
        sessions: String(pack.sessions),
        userId: session.user.id,
      },
    })
    return NextResponse.json({ url: checkoutSession.url })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
