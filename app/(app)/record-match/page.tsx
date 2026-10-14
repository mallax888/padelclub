import { createServerClient } from '@/lib/supabase-server'
import RecordMatchForm from '@/components/matches/RecordMatchForm'
import { formatDate } from '@/lib/utils'

export default async function RecordMatchPage({
  searchParams,
}: {
  searchParams: { bookingId?: string }
}) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  const userId = session!.user.id

  const { data: players } = await supabase
    .from('profiles')
    .select('id, full_name, nickname, ranking_points')
    .not('role', 'eq', 'staff')
    .order('full_name', { ascending: true })

  // Arriving from "Record the result" on a past booking. Who played is already
  // known -- the organiser plus whoever took a seat -- so there is no reason to
  // make someone pick those same four names out of the member list again.
  // Without a bookingId this is the blank form exactly as before.
  let prefill: { label: string; playerIds: string[] } | null = null

  if (searchParams.bookingId) {
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, date, start_time, user_id, courts(name)')
      .eq('id', searchParams.bookingId)
      .maybeSingle()

    // Only for the person who booked it: someone else's booking is none of
    // their business, and the roster read below would say who played.
    if (booking && booking.user_id === userId) {
      const [{ data: splits }, { data: seats }] = await Promise.all([
        supabase
          .from('booking_splits')
          .select('user_id, status')
          .eq('booking_id', booking.id),
        supabase
          .from('open_match_players')
          .select('player_id, status, open_matches!inner(booking_id)')
          .eq('open_matches.booking_id', booking.id),
      ])

      // Organiser first so they land in Team 1, then everyone who actually
      // held a seat. A withdrawn or declined seat means that person didn't
      // play, so they are left out rather than pre-filled wrongly.
      const ids: string[] = [booking.user_id]
      for (const s of (splits ?? []) as any[]) {
        if (s.user_id && s.status !== 'cancelled' && !ids.includes(s.user_id)) ids.push(s.user_id)
      }
      for (const s of (seats ?? []) as any[]) {
        if (s.player_id && s.status === 'accepted' && !ids.includes(s.player_id)) ids.push(s.player_id)
      }

      prefill = {
        label: `${(booking.courts as any)?.name ?? 'Court'} · ${formatDate(booking.date)} · ${booking.start_time.slice(0, 5)}`,
        playerIds: ids.slice(0, 4),
      }
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Record a match</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Enter the result to update the leaderboard</p>
      </div>
      <RecordMatchForm players={players ?? []} currentUserId={userId} prefill={prefill} />
    </div>
  )
}
