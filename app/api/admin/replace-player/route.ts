import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

// Swapping a player who pulled out relabels their seat in place: the seat's
// payment state (status, amount, stripe_payment_id for a split) is left
// exactly as it was, so no refund is issued and the replacement isn't
// charged again -- the two players settle up between themselves. The only
// thing recorded is who previously held the seat, so the roster can still
// show whose spot it was.

// Postgres "column does not exist". The replaced_* columns come from
// 019_seat_replacement_history.sql, and a deployment that hasn't run it yet
// failed every swap with a generic "please try again". The seat history is a
// nice-to-have; being unable to replace a player who pulled out is a real
// problem on a Saturday morning, so the swap goes ahead without it.
const UNDEFINED_COLUMN = '42703'

type SeatTable = 'booking_splits' | 'open_match_players'

// Applies the swap, dropping the history columns and carrying on if they
// aren't there. Returns null on success, or a message explaining what
// actually went wrong -- this is a staff-only route, so a precise answer is
// more useful than a safe one. The previous code collapsed every failure,
// including a missing column and an RLS refusal, into one dead end.
//
// The write goes through the service-role client, unlike cancel-booking and
// reschedule-booking which deliberately write as the caller so that "Staff
// can manage all bookings" enforces venue scoping for them. That works on
// `bookings`, which has that policy. booking_splits and open_match_players
// were created outside the migrations with row-level security switched on and
// no staff write policy at all, so the same approach silently matched zero
// rows and every swap failed. Scoping is enforced before we get here instead:
// the caller must be able to read the parent booking through their own
// client, and `bookings` is the table whose staff policies are properly
// venue- and country-scoped (017_country_scoped_staff.sql).
async function applySwap(
  supabase: ReturnType<typeof createAdminClient>,
  table: SeatTable,
  rowId: string,
  patch: Record<string, unknown>,
  historyPatch: Record<string, unknown>,
): Promise<string | null> {
  const attempt = (body: Record<string, unknown>) =>
    supabase.from(table).update(body as any).eq('id', rowId).select('id').maybeSingle()

  let { data, error } = await attempt({ ...patch, ...historyPatch })

  if (error?.code === UNDEFINED_COLUMN) {
    console.error(
      `${table}: seat-history columns missing, so this swap records no predecessor. ` +
      'Run supabase/migrations/019_seat_replacement_history.sql.',
      error.message,
    )
    ;({ data, error } = await attempt(patch))
  }

  if (error) {
    console.error(`Could not replace seat ${rowId} on ${table}:`, error.code, error.message)
    return `The database rejected that change: ${error.message}`
  }
  if (!data) {
    console.error(`Replacing seat ${rowId} on ${table} matched no row — the seat may have just been removed`)
    return 'That seat no longer exists. Close the panel and reopen it to see the current roster.'
  }
  return null
}

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

  // Every read below stays on the caller's own session client, so existing
  // RLS decides what this staff member is allowed to see. The parent booking
  // read in particular is the venue/country gate: `bookings` carries the
  // properly scoped staff policies from 017_country_scoped_staff.sql, so a
  // manager scoped to one venue simply cannot see a booking outside it, and
  // this route refuses before writing anything.
  //
  // The replaced_* columns come from 019_seat_replacement_history.sql and
  // aren't in the generated types until those are regenerated against the
  // live database, hence the casts on the patch objects below.
  const admin = createAdminClient()

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

    // Doubles as the scope gate for the service-role write below: if this
    // staff account can't read the parent booking, the booking is outside
    // their venue or country and nothing further happens.
    const { data: booking } = await supabase
      .from('bookings')
      .select('user_id')
      .eq('id', current.booking_id)
      .maybeSingle()
    if (!booking) {
      return NextResponse.json({ error: 'That booking is outside your venue.' }, { status: 403 })
    }
    // Without this, slotting in someone who already holds a seat on this
    // booking (or is the organizer, whose share is the booking itself) would
    // give them two seats and double-count them in the collected total.
    if (booking.user_id === newPlayerId) {
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

    const failure = await applySwap(
      admin,
      'booking_splits',
      rowId,
      { user_id: newPlayerId },
      { replaced_user_id: current.user_id, replaced_at: replacedAt },
    )
    if (failure) return NextResponse.json({ error: failure }, { status: 500 })
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

  const { data: match } = await supabase
    .from('open_matches')
    .select('organizer_id, booking_id')
    .eq('id', current.match_id)
    .maybeSingle()
  if (!match) {
    return NextResponse.json({ error: 'That match is outside your venue.' }, { status: 403 })
  }
  // Same venue/country gate as the split branch: the parent booking has to be
  // readable by this staff account before the service-role write happens.
  if (match.booking_id) {
    const { data: parentBooking } = await supabase
      .from('bookings')
      .select('id')
      .eq('id', match.booking_id)
      .maybeSingle()
    if (!parentBooking) {
      return NextResponse.json({ error: 'That booking is outside your venue.' }, { status: 403 })
    }
  }
  // Same reason as the split branch: one player, one seat per match.
  if (match.organizer_id === newPlayerId) {
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
  const failure = await applySwap(
    admin,
    'open_match_players',
    rowId,
    { player_id: newPlayerId, status: 'accepted' },
    { replaced_player_id: current.player_id, replaced_at: replacedAt },
  )
  if (failure) return NextResponse.json({ error: failure }, { status: 500 })

  return NextResponse.json({ success: true })
}
