import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase-admin'
import { sendBookingConfirmationEmail } from '@/lib/emails'
import { formatDate, formatNzd } from '@/lib/utils'
import { getAppUrl } from '@/lib/env'

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
    const { bookingId, userId, splitId, type, sessions, tier } = session.metadata
    const supabase = createAdminClient()
    if (type === 'membership' && userId && tier) {
      // Re-setting the same tier on a retried delivery is harmless (unlike
      // credits, there's nothing to double-apply), so no dedup guard needed.
      await supabase.from('profiles').update({ membership_tier: tier }).eq('id', userId)
    } else if (type === 'credit_pack' && userId) {
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
        // An atomic DB-side increment, not select-then-update -- two credit
        // purchases landing close together for the same user would otherwise
        // race and one increment could get silently lost.
        await supabase.rpc('increment_credits', { p_user_id: userId, p_amount: parseInt(sessions, 10) })
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
      // Bookings are inserted already 'confirmed' at checkout time (before
      // payment), so status can't be used as the retry guard here the way it
      // is for split_payment — stripe_payment_id starting out null is what
      // marks this as the first successful payment for this booking. A
      // retried event finds it already set and skips re-sending the email.
      const { data: booking } = await supabase.from('bookings').update({
        status: 'confirmed',
        payment_method: 'card',
        stripe_payment_id: session.payment_intent,
      }).eq('id', bookingId)
        .is('stripe_payment_id', null)
        .select('date, start_time, end_time, duration_minutes, price_nzd, user_id, courts(name, type)')
        .maybeSingle()

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
              appUrl: getAppUrl(request),
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
