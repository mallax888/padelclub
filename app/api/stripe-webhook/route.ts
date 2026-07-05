import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase-admin'

export async function POST(request: Request) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!
  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 })
  }
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as any
    const { bookingId, userId, splitId, type, sessions } = session.metadata
    const supabase = createAdminClient() as any
    if (type === 'credit_pack' && userId) {
      await supabase.from('credit_transactions').insert({
        user_id: userId,
        amount: parseInt(sessions, 10),
        type: 'purchase',
        description: `Purchased ${sessions}-session pack`,
      })
      const { data: profile } = await supabase.from('profiles').select('credits').eq('id', userId).single()
      await supabase.from('profiles').update({ credits: (profile?.credits ?? 0) + parseInt(sessions, 10) }).eq('id', userId)
    } else if (type === 'split_payment' && splitId) {
      await supabase.from('booking_splits').update({ status: 'paid', stripe_payment_id: session.payment_intent }).eq('id', splitId)
      const { data: split } = await supabase
        .from('booking_splits')
        .select('invited_by, amount_nzd, profiles!booking_splits_user_id_fkey(full_name, nickname)')
        .eq('id', splitId)
        .single()
      if (split) {
        const payerName = split.profiles?.nickname ?? split.profiles?.full_name ?? 'Someone'
        await supabase.from('notifications').insert({
          user_id: split.invited_by,
          type: 'split_paid',
          title: 'Split payment received',
          message: payerName + ' paid their share of $' + split.amount_nzd,
          data: JSON.stringify({ splitId, amount: split.amount_nzd }),
        })
      }
    } else if (bookingId) {
      await supabase.from('bookings').update({
        status: 'confirmed',
        payment_method: 'card',
        stripe_payment_id: session.payment_intent,
      }).eq('id', bookingId)
    }
  }
  return NextResponse.json({ received: true })
}
