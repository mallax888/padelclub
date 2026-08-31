import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { stripe } from '@/lib/stripe'

export type CancellableBooking = {
  id: string
  user_id: string | null
  date: string
  start_time: string
  price_nzd: number
  stripe_payment_id: string | null
  payment_method: string
}

export type CancellationResult = {
  isPaid: boolean
  hoursUntil: number
  creditAmount: number      // dollars added to profiles.credits (card, <24h notice)
  creditsRefunded: number   // session credits added to profiles.credits (credits payment, >=24h notice)
  refundFailed: boolean
}

// Shared by both the member-facing cancel route and the Admin dashboard's
// staff cancel -- previously Admin's cancel bypassed all of this and just
// flipped the booking to 'cancelled' with no refund of any kind, silently
// leaving a paying customer's money uncollected.
//
// Cancellation policy (shown to the member before they confirm, see
// MyBookingsList): 24hrs+ notice before the booking's start time = a full
// refund (the card charge refunded via Stripe, or a full session credit
// back for a booking paid with session credits); under 24hrs = 50% of the
// price back as account credit for a card booking, or nothing back for a
// credits booking -- a punch-card session is all-or-nothing, there's no
// partial session to return.
export async function applyCancellationRefund(
  admin: SupabaseClient<Database>,
  booking: CancellableBooking,
): Promise<CancellationResult> {
  const isPaid = !!booking.stripe_payment_id || booking.payment_method === 'credits'
  const hoursUntil = (new Date(`${booking.date}T${booking.start_time}`).getTime() - Date.now()) / (1000 * 60 * 60)

  let creditAmount = 0
  let creditsRefunded = 0
  let refundFailed = false

  if (booking.stripe_payment_id) {
    if (hoursUntil >= 24) {
      try {
        await stripe.refunds.create({ payment_intent: booking.stripe_payment_id })
      } catch (err: any) {
        // A charge that's already fully refunded (e.g. a retried request
        // that raced a status guard upstream) errors the same way a genuine
        // failure would -- treat that one case as success, since the
        // money's already back.
        if (err?.code !== 'charge_already_refunded') {
          console.error('Stripe refund failed for booking', booking.id, err)
          refundFailed = true
        }
      }
    } else if (booking.user_id) {
      creditAmount = Math.round(booking.price_nzd * 0.5)
      await admin.rpc('increment_credits', { p_user_id: booking.user_id, p_amount: creditAmount })
    }
  } else if (booking.payment_method === 'credits' && booking.user_id && hoursUntil >= 24) {
    creditsRefunded = 1
    await admin.rpc('increment_credits', { p_user_id: booking.user_id, p_amount: 1 })
    await admin.from('credit_transactions').insert({
      user_id: booking.user_id,
      amount: 1,
      type: 'refund',
      booking_id: booking.id,
      description: 'Session credit refunded — booking cancelled with 24+ hours notice',
    })
  }

  return { isPaid, hoursUntil, creditAmount, creditsRefunded, refundFailed }
}
