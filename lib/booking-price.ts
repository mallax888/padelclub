import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { MEMBERSHIP_CONFIG, type MembershipTier } from '@/types/database'
import { computeCourtPrice } from '@/lib/pricing'

// Bookings are inserted directly by the browser client, so price_nzd on the
// row can't be trusted -- this recomputes the authoritative price from the
// court's real rate + the booker's current membership discount, corrects the
// row if it's wrong, and returns the verified amount for whoever is about to
// charge a card against it (create-checkout, pay-split).
export async function verifyAndCorrectBookingPrice(
  admin: SupabaseClient<Database>,
  bookingId: string,
): Promise<{ verifiedPrice: number; userId: string | null } | null> {
  const { data: booking } = await admin
    .from('bookings')
    .select('id, court_id, date, start_time, duration_minutes, price_nzd, user_id')
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
  const verifiedPrice = computeCourtPrice(court, booking.date, booking.start_time.slice(0, 5), durationHours, discount)

  if (verifiedPrice !== booking.price_nzd) {
    await admin.from('bookings').update({ price_nzd: verifiedPrice }).eq('id', bookingId)
  }

  return { verifiedPrice, userId: booking.user_id }
}
