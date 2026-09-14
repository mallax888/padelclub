import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export async function GET(request: Request) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
  if (!profile || !['staff', 'admin'].includes((profile as any).role)) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const bookingId = new URL(request.url).searchParams.get('bookingId')
  if (!bookingId) {
    return NextResponse.json({ error: 'Missing bookingId' }, { status: 400 })
  }

  // Caller's own session client (not the service-role admin client) so
  // "Staff can manage all bookings" RLS scopes this to the caller's own
  // venue/country -- same pattern as cancel-booking/reschedule-booking.
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, price_nzd, status, user_id, profiles!bookings_user_id_fkey(full_name, nickname)')
    .eq('id', bookingId)
    .maybeSingle()
  if (!booking) {
    return NextResponse.json({ error: 'Booking not found or outside your venue' }, { status: 404 })
  }

  const { data: openMatch } = await supabase
    .from('open_matches')
    .select('id, organizer_id')
    .eq('booking_id', bookingId)
    .maybeSingle()

  const organizerName = (booking as any).profiles?.nickname ?? (booking as any).profiles?.full_name ?? '—'

  if (openMatch) {
    const { data: matchPlayers } = await supabase
      .from('open_match_players')
      .select('id, player_id, status, profiles!open_match_players_player_id_fkey(full_name, nickname)')
      .eq('match_id', openMatch.id)

    // Open Play has no per-player payment tracking today -- joining a match
    // doesn't create a booking_splits row or any other payment record, so
    // there's no real "paid" status to show here, only join status.
    const players = [
      { id: booking.user_id, name: organizerName, role: 'organizer', joinStatus: null as string | null },
      ...(matchPlayers ?? [])
        .filter((p: any) => p.status !== 'declined')
        .map((p: any) => ({
          id: p.player_id,
          name: p.profiles?.nickname ?? p.profiles?.full_name ?? '—',
          role: 'joined',
          joinStatus: p.status as string,
        })),
    ]

    return NextResponse.json({ type: 'open_play', players, priceNzd: booking.price_nzd })
  }

  const { data: splits } = await supabase
    .from('booking_splits')
    .select('id, user_id, amount_nzd, status, profiles!booking_splits_user_id_fkey(full_name, nickname)')
    .eq('booking_id', bookingId)

  const totalShares = (splits?.length ?? 0) + 1
  const organizerShare = Math.round(booking.price_nzd / totalShares)
  // A booking sits in 'pending' until its own checkout succeeds -- only then
  // is the organizer's share actually paid, same as everyone else's split.
  const organizerPaid = booking.status !== 'pending'
  const paidTotal = (organizerPaid ? organizerShare : 0)
    + (splits ?? []).filter((s: any) => s.status === 'paid').reduce((sum: number, s: any) => sum + Number(s.amount_nzd), 0)

  const players = [
    { id: booking.user_id, name: organizerName, role: 'organizer', paymentStatus: organizerPaid ? 'paid' : 'pending', amount: organizerShare },
    ...(splits ?? []).map((s: any) => ({
      id: s.id,
      name: s.profiles?.nickname ?? s.profiles?.full_name ?? '—',
      role: 'invited',
      paymentStatus: s.status as string,
      amount: Number(s.amount_nzd),
    })),
  ]

  return NextResponse.json({ type: 'split', players, priceNzd: booking.price_nzd, paidTotal })
}
