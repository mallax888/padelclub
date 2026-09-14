import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

// Swapping a player who pulled out relabels their seat in place: the seat's
// payment state (status, amount, stripe_payment_id for a split) is left
// exactly as it was, so no refund is issued and the replacement isn't
// charged again -- the two players settle up between themselves. The only
// thing recorded is who previously held the seat, so the roster can still
// show whose spot it was.
export async function POST(request: Request) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
  if (!profile || !['staff', 'admin'].includes((profile as any).role)) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const { type, rowId, newPlayerId } = await request.json()
  if (!rowId || !newPlayerId || (type !== 'split' && type !== 'open_match')) {
    return NextResponse.json({ error: 'Missing or invalid type, rowId, or newPlayerId' }, { status: 400 })
  }

  const replacedAt = new Date().toISOString()

  // Same pattern as cancel-booking/reschedule-booking: the caller's own
  // session client means existing RLS decides whether this seat is inside
  // their venue/country, rather than re-deriving that scoping here.
  //
  // The replaced_* columns come from 019_seat_replacement_history.sql and
  // aren't in the generated types until those are regenerated against the
  // live database, hence the casts on the patch objects below.
  if (type === 'split') {
    const { data: current } = await supabase
      .from('booking_splits')
      .select('id, user_id, booking_id')
      .eq('id', rowId)
      .maybeSingle()
    if (!current) {
      return NextResponse.json({ error: 'Seat not found or outside your venue' }, { status: 404 })
    }
    if (current.user_id === newPlayerId) {
      return NextResponse.json({ error: 'That player already has this seat.' }, { status: 400 })
    }

    // Without this, slotting in someone who already holds a seat on this
    // booking (or is the organizer, whose share is the booking itself) would
    // give them two seats and double-count them in the collected total.
    const { data: booking } = await supabase
      .from('bookings')
      .select('user_id')
      .eq('id', current.booking_id)
      .maybeSingle()
    if (booking?.user_id === newPlayerId) {
      return NextResponse.json({ error: 'They booked this court — they already have a spot.' }, { status: 400 })
    }
    const { data: existingSeat } = await supabase
      .from('booking_splits')
      .select('id')
      .eq('booking_id', current.booking_id)
      .eq('user_id', newPlayerId)
      .maybeSingle()
    if (existingSeat) {
      return NextResponse.json({ error: 'They already have a spot on this booking.' }, { status: 400 })
    }

    const { data: updated, error } = await supabase
      .from('booking_splits')
      .update({ user_id: newPlayerId, replaced_user_id: current.user_id, replaced_at: replacedAt } as any)
      .eq('id', rowId)
      .select('id')
      .maybeSingle()
    if (error || !updated) {
      return NextResponse.json({ error: 'Could not replace that player — please try again.' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  }

  const { data: current } = await supabase
    .from('open_match_players')
    .select('id, player_id, match_id')
    .eq('id', rowId)
    .maybeSingle()
  if (!current) {
    return NextResponse.json({ error: 'Seat not found or outside your venue' }, { status: 404 })
  }
  if (current.player_id === newPlayerId) {
    return NextResponse.json({ error: 'That player already has this seat.' }, { status: 400 })
  }

  // Same reason as the split branch: one player, one seat per match.
  const { data: match } = await supabase
    .from('open_matches')
    .select('organizer_id')
    .eq('id', current.match_id)
    .maybeSingle()
  if (match?.organizer_id === newPlayerId) {
    return NextResponse.json({ error: 'They organised this match — they already have a spot.' }, { status: 400 })
  }
  const { data: existingSeat } = await supabase
    .from('open_match_players')
    .select('id')
    .eq('match_id', current.match_id)
    .eq('player_id', newPlayerId)
    .neq('status', 'declined')
    .maybeSingle()
  if (existingSeat) {
    return NextResponse.json({ error: 'They already have a spot in this match.' }, { status: 400 })
  }

  // A replacement joining an open match takes the seat outright -- they're
  // not re-requesting a spot the organizer already approved.
  const { data: updated, error } = await supabase
    .from('open_match_players')
    .update({ player_id: newPlayerId, status: 'accepted', replaced_player_id: current.player_id, replaced_at: replacedAt } as any)
    .eq('id', rowId)
    .select('id')
    .maybeSingle()
  if (error || !updated) {
    return NextResponse.json({ error: 'Could not replace that player — please try again.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
