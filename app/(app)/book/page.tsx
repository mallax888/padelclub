import { createServerClient } from '@/lib/supabase-server'
import BookingFlow from '@/components/booking/BookingFlow'

// How many past split partners to hand the booking flow. The picker shows the
// first few and everyone else is reachable through search, so this only needs
// to be deep enough to cover a regular group.
const RECENT_PARTNER_LIMIT = 12

export default async function BookPage() {
  const supabase = createServerClient()
  const [{ data: courts }, { data: { session } }] = await Promise.all([
    supabase.from('courts').select('*').eq('is_active', true),
    supabase.auth.getSession(),
  ])
  const userId = session!.user.id
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  // The split picker used to load every profile in the database, alphabetically,
  // and render all of them -- fine at a dozen members, a scroll of strangers
  // once 36 clubs across three countries are live. Instead: the people this
  // member has actually split a court with, which booking_splits already
  // records, counted in both directions (courts they organised and courts they
  // were invited to). Anyone else is found by name via /api/players/search.
  const { data: splitRows } = await supabase
    .from('booking_splits')
    .select('user_id, invited_by')
    .or(`invited_by.eq.${userId},user_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(200)

  const tally = new Map<string, number>()
  for (const row of splitRows ?? []) {
    const other = row.invited_by === userId ? row.user_id : row.invited_by
    if (!other || other === userId) continue
    tally.set(other, (tally.get(other) ?? 0) + 1)
  }

  // Most-played-with first, so a regular four surfaces ahead of a one-off.
  const partnerIds = Array.from(tally.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, RECENT_PARTNER_LIMIT)
    .map(([id]) => id)

  const { data: partnerProfiles } = partnerIds.length
    ? await supabase.from('profiles').select('id, full_name, nickname').in('id', partnerIds)
    : { data: [] }

  const recentPlayers = partnerIds.flatMap(id => {
    const p = (partnerProfiles ?? []).find(x => x.id === id)
    return p ? [{ ...p, splitCount: tally.get(id)! }] : []
  })

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Book a court</h1>
        <p className="text-sm text-gray-500 mt-1">Select a date, court and time to make your booking</p>
      </div>
      <BookingFlow courts={courts ?? []} profile={profile!} userId={userId} recentPlayers={recentPlayers} />
    </div>
  )
}
