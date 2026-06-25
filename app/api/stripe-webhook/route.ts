import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServerClient } from '@/lib/supabase-server'

export async function POST(request: Request) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!

  let event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as any
    const { bookingId, userId } = session.metadata

    const supabase = createServerClient()
    await (supabase as any)
      .from('bookings')
      .update({
        status: 'confirmed',
        payment_method: 'stripe',
        stripe_payment_id: session.payment_intent,
      })
      .eq('id', bookingId)
  }

  return NextResponse.json({ received: true })
}

