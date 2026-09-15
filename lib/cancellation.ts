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
  splitsRefunded: number    // co-players refunded to their card
  splitsWithdrawn: number   // unpaid split requests withdrawn
}

// Refunds one payment intent, tolerating the one failure that isn't a
// failure: a charge that's already fully refunded (a retried request racing
// a status guard upstream) errors exactly like a genuine problem would, but
// the money is already back where it belongs. Returns whether the payer has
// been made whole.
async function refundIntent(paymentIntentId: string, bookingId: string): Promise<boolean> {
  try {
    await stripe.refunds.create({ payment_intent: paymentIntentId })
    return true
  } catch (err: any) {
    if (err?.code === 'charge_already_refunded') return true
    console.error('Stripe refund failed for booking', bookingId, paymentIntentId, err)
    return false
  }
}

// What this person's card was actually charged, in cents. Asking Stripe
// beats recomputing price_nzd / shares: the booker is charged their share as
// the split stood at checkout, so a split added afterwards would make the
// recomputed figure smaller than the real charge and quietly under-credit
// them. Falls back to the recomputation only if Stripe can't be reached.
async function amountPaidCents(
  paymentIntentId: string,
  fallbackDollars: number,
): Promise<number> {
  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId)
    if (intent.amount_received > 0) return intent.amount_received
  } catch (err) {
    console.error('Could not read payment intent', paymentIntentId, err)
  }
  return Math.round(fallbackDollars * 100)
}

// Shared by both the member-facing cancel route and the Admin dashboard's
// staff cancel -- previously Admin's cancel bypassed all of this and just
// flipped the booking to 'cancelled' with no refund of any kind, silently
// leaving a paying customer's money uncollected.
//
// Cancellation policy (shown to the member before they confirm, see
// MyBookingsList):
//
//   * The person cancelling: 24hrs+ notice before the booking's start time
//     = a full refund (the card charge refunded via Stripe, or a full
//     session credit back for a booking paid with session credits); under
//     24hrs = 50% of what they paid back as account credit for a card
//     booking, or nothing back for a credits booking -- a punch-card session
//     is all-or-nothing, there's no partial session to return.
//
//   * Everyone else on a split booking: always refunded in full, whatever
//     the notice. They didn't make the decision to cancel, so the late
//     penalty shouldn't land on them.
//
//   * A staff cancellation (byStaff): nobody is penalised, including the
//     booker. The club cancels for the club's own reasons -- a flooded
//     court, maintenance, a double-booking -- and charging a member half
//     their money for that isn't defensible.
//
// Unpaid split requests are withdrawn rather than left sitting in the
// invitee's My bookings, where paying one would buy a share of a court
// nobody is playing on.
export async function applyCancellationRefund(
  admin: SupabaseClient<Database>,
  booking: CancellableBooking,
  options: { byStaff?: boolean } = {},
): Promise<CancellationResult> {
  const isPaid = !!booking.stripe_payment_id || booking.payment_method === 'credits'
  const hoursUntil = (new Date(`${booking.date}T${booking.start_time}`).getTime() - Date.now()) / (1000 * 60 * 60)
  const fullRefund = options.byStaff === true || hoursUntil >= 24

  let creditAmount = 0
  let creditsRefunded = 0
  let refundFailed = false
  let splitsRefunded = 0
  let splitsWithdrawn = 0

  // Everyone who paid a share, refunded in full. Done before the booker's
  // own branch so a failure here still surfaces through refundFailed even
  // when the booker's side succeeds.
  const { data: paidSplits } = await admin
    .from('booking_splits')
    .select('id, stripe_payment_id')
    .eq('booking_id', booking.id)
    .eq('status', 'paid')

  for (const split of paidSplits ?? []) {
    if (!split.stripe_payment_id) continue
    if (await refundIntent(split.stripe_payment_id, booking.id)) {
      // .eq('status','paid') keeps a retry from counting the same seat
      // twice; the refund itself is already idempotent via refundIntent.
      const { data: marked } = await admin
        .from('booking_splits')
        .update({ status: 'refunded' })
        .eq('id', split.id)
        .eq('status', 'paid')
        .select('id')
        .maybeSingle()
      if (marked) splitsRefunded++
    } else {
      refundFailed = true
    }
  }

  // Requests nobody has paid yet: withdraw them so they can't be paid
  // against a cancelled court. pay-split already refuses anything that
  // isn't 'pending', so this closes that door on its own.
  const { data: withdrawn } = await admin
    .from('booking_splits')
    .update({ status: 'cancelled' })
    .eq('booking_id', booking.id)
    .eq('status', 'pending')
    .select('id')
  splitsWithdrawn = withdrawn?.length ?? 0

  // The booker's own money.
  if (booking.stripe_payment_id) {
    if (fullRefund) {
      if (!(await refundIntent(booking.stripe_payment_id, booking.id))) {
        refundFailed = true
      }
    } else if (booking.user_id) {
      // Half of what this person actually paid -- not half the court fee.
      // On a $120 court split four ways the booker is charged $30, and
      // crediting half the fee handed them $60 for a $30 booking.
      const shareCount = (paidSplits?.length ?? 0) + splitsWithdrawn + 1
      const paidCents = await amountPaidCents(
        booking.stripe_payment_id,
        booking.price_nzd / shareCount,
      )
      // Rounded to whole dollars because increment_credits takes an int
      // (005_data_integrity_fixes.sql) -- account credit has always been
      // counted in whole dollars. Passing cents here would have Postgres
      // round it anyway, and the figure reported back to the member would
      // then disagree with what actually landed in their balance.
      creditAmount = Math.round((paidCents * 0.5) / 100)
      await admin.rpc('increment_credits', { p_user_id: booking.user_id, p_amount: creditAmount })
    }
  } else if (booking.payment_method === 'credits' && booking.user_id && fullRefund) {
    creditsRefunded = 1
    await admin.rpc('increment_credits', { p_user_id: booking.user_id, p_amount: 1 })
    await admin.from('credit_transactions').insert({
      user_id: booking.user_id,
      amount: 1,
      type: 'refund',
      booking_id: booking.id,
      description: options.byStaff
        ? 'Session credit refunded — booking cancelled by the club'
        : 'Session credit refunded — booking cancelled with 24+ hours notice',
    })
  }

  return { isPaid, hoursUntil, creditAmount, creditsRefunded, refundFailed, splitsRefunded, splitsWithdrawn }
}
