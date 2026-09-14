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
      .select('id, user_id')
      .eq('id', rowId)
      .maybeSingle()
    if (!current) {
      return NextResponse.json({ error: 'Seat not found or outside your venue' }, { status: 404 })
    }
    if (current.user_id === newPlayerId) {
      return NextResponse.json({ error: 'That player already has this seat.' }, { status: 400 })
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
    .select('id, player_id')
    .eq('id', rowId)
    .maybeSingle()
  if (!current) {
    return NextResponse.json({ error: 'Seat not found or outside your venue' }, { status: 404 })
  }
  if (current.player_id === newPlayerId) {
    return NextResponse.json({ error: 'That player already has this seat.' }, { status: 400 })
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
