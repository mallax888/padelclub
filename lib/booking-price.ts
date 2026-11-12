import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { MEMBERSHIP_CONFIG, type MembershipTier } from '@/types/database'
import { basePricePerHour } from '@/lib/pricing'
import { offerValidForBooking, priceWithOffer } from '@/lib/offer-rules'
import { toMin } from '@/lib/waitlist-rules'

// Bookings are inserted directly by the browser client, so price_nzd on the
// row can't be trusted -- this recomputes the authoritative price from the
// court's real rate + the booker's current membership discount, corrects the
// row if it's wrong, and returns the verified amount for whoever is about to
// charge a card against it (create-checkout, pay-split).
//
// A booking made under a "fill my empty courts" offer carries an offer_id, which is
// also a claim from the browser. It is honoured only if the offer really covers that
// booking and was open when the booking was made; otherwise the offer is dropped and
// the price goes back to the normal one. The player gets the better of the offer and
// their member discount, never both.
export async function verifyAndCorrectBookingPrice(
  admin: SupabaseClient<Database>,
  bookingId: string,
): Promise<{ verifiedPrice: number; userId: string | null; status: string; stripePaymentId: string | null } | null> {
  const { data: booking } = await admin
    .from('bookings')
    .select('id, court_id, date, start_time, duration_minutes, price_nzd, user_id, status, stripe_payment_id')
    .eq('id', bookingId)
    .single()
  if (!booking) return null

  const { data: court } = await admin
    .from('courts')
    .select('price_per_hour, price_per_hour_peak')
    .eq('id', booking.court_id)
    .single()
  if (!court) return null

  let discount = 0
  if (booking.user_id) {
    const { data: profile } = await admin
      .from('profiles')
      .select('membership_tier')
      .eq('id', booking.user_id)
      .single()
    const tier = (profile?.membership_tier ?? 'casual') as MembershipTier
    discount = MEMBERSHIP_CONFIG[tier]?.discount ?? 0
  }

  const durationHours = booking.duration_minutes / 60

  // The offer the booking claims, if any. The column only exists once the offers
  // database change has been run, so a failed read just means "no offer".
  let offerPercent: number | null = null
  const { data: claim, error: claimError } = await (admin as any).from('bookings').select('offer_id, created_at').eq('id', bookingId).maybeSingle()
  const claimedOffer: string | null = !claimError ? claim?.offer_id ?? null : null
  if (claimedOffer) {
    const { data: offer } = await (admin as any).from('court_offers').select('*').eq('id', claimedOffer).maybeSingle()
    const { data: venue } = await admin.from('courts').select('venue_slug').eq('id', booking.court_id).single()
    if (offer && venue && offerValidForBooking(offer, {
      createdAtMs: Date.parse(claim.created_at), venueSlug: venue.venue_slug, date: booking.date,
      startMin: toMin(booking.start_time), durMin: booking.duration_minutes,
    })) offerPercent = offer.discount_percent
  }

  const { price: verifiedPrice, offerApplied } = priceWithOffer(
    basePricePerHour(court, booking.date, booking.start_time.slice(0, 5)), durationHours, discount, offerPercent,
  )

  if (verifiedPrice !== booking.price_nzd) {
    await admin.from('bookings').update({ price_nzd: verifiedPrice }).eq('id', bookingId)
  }
  // An offer that did not end up applying is dropped, so results never count it.
  if (claimedOffer && !offerApplied) await (admin as any).from('bookings').update({ offer_id: null }).eq('id', bookingId)

  return { verifiedPrice, userId: booking.user_id, status: booking.status, stripePaymentId: booking.stripe_payment_id }
}
