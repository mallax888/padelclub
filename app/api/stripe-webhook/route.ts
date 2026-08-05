import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase-admin'
import { sendBookingConfirmationEmail } from '@/lib/emails'
import { formatDate, formatNzd } from '@/lib/utils'

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
    const supabase = createAdminClient()
    if (type === 'credit_pack' && userId) {
      // Stripe can redeliver this event (timeout, 5xx, etc). stripe_session_id
      // is unique, so a retry's insert is ignored instead of applying the
      // credits twice — only add the balance when a row was actually inserted.
      const { data: inserted } = await supabase
        .from('credit_transactions')
        .upsert({
          user_id: userId,
          amount: parseInt(sessions, 10),
          type: 'purchase',
          description: `Purchased ${sessions}-session pack`,
          stripe_session_id: session.id,
        }, { onConflict: 'stripe_session_id', ignoreDuplicates: true })
        .select()
      if (inserted && inserted.length > 0) {
        const { data: profile } = await supabase.from('profiles').select('credits').eq('id', userId).single()
        await supabase.from('profiles').update({ credits: (profile?.credits ?? 0) + parseInt(sessions, 10) }).eq('id', userId)
      }
    } else if (type === 'split_payment' && splitId) {
      // Only the first delivery of a retried event actually matches
      // status='pending' and flips it — a retry is a no-op, no duplicate
      // "paid their share" notification.
      const { data: split } = await supabase
        .from('booking_splits')
        .update({ status: 'paid', stripe_payment_id: session.payment_intent })
        .eq('id', splitId)
        .eq('status', 'pending')
        .select('invited_by, amount_nzd, profiles!booking_splits_user_id_fkey(full_name, nickname)')
        .maybeSingle()
      if (split) {
        const payerName = split.profiles?.nickname ?? split.profiles?.full_name ?? 'Someone'
        const { error: notifyError } = await supabase.from('notifications').insert({
          user_id: split.invited_by,
          type: 'split_paid',
          message: payerName + ' paid their share of $' + split.amount_nzd,
        })
        if (notifyError) {
          console.error('Failed to notify', split.invited_by, 'of split payment:', notifyError)
        }
      }
    } else if (bookingId) {
      const { data: booking } = await supabase.from('bookings').update({
        status: 'confirmed',
        payment_method: 'card',
        stripe_payment_id: session.payment_intent,
      }).eq('id', bookingId)
        .select('date, start_time, end_time, duration_minutes, price_nzd, user_id, courts(name, type)')
        .single()

      if (booking?.user_id) {
        const { data: recipient } = await supabase
          .from('profiles')
          .select('email, full_name, nickname')
          .eq('id', booking.user_id)
          .single()

        if (recipient?.email) {
          try {
            await sendBookingConfirmationEmail({
              to: recipient.email,
              name: recipient.nickname ?? recipient.full_name ?? 'there',
              court: `${(booking.courts as any)?.name ?? 'Court'} — ${(booking.courts as any)?.type ?? ''}`,
              date: formatDate(booking.date),
              time: `${booking.start_time.slice(0, 5)} — ${booking.end_time.slice(0, 5)}`,
              duration: `${booking.duration_minutes} min`,
              total: formatNzd(booking.price_nzd),
            })
          } catch (emailError) {
            // Booking is already confirmed — don't fail the webhook (and
            // trigger a Stripe retry) just because the email failed to send.
            console.error('Failed to send booking confirmation email:', emailError)
          }
        }
      }
    }
  }
  return NextResponse.json({ received: true })
}
