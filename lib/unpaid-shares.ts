// Loading "unpaid shares" for the admin pages: shares a friend has joined but
// not paid for. Invite seats nobody has taken yet have no person on them and
// aren't owed by anyone, so they're left out. Uses the caller's own Supabase
// client (staff read access), scoped through the booking's court like the other
// admin queries.
import type { UnpaidShareRow } from '@/lib/money-demand'

export type ShareScope = { venueSlug?: string | null; venueSlugs?: string[] | null }

export function unpaidSharesQuery(supabase: any, scope: ShareScope) {
  let q = supabase.from('booking_splits')
    .select('id, amount_nzd, created_at, bookings!inner(date, start_time, status, courts!inner(name, venue_slug)), debtor:profiles!booking_splits_user_id_fkey(full_name, nickname), organiser:profiles!booking_splits_invited_by_fkey(full_name, nickname)')
    .eq('status', 'pending')
    .not('user_id', 'is', null)
    .order('created_at', { ascending: true })
    .limit(500)
  if (scope.venueSlug) q = q.eq('bookings.courts.venue_slug', scope.venueSlug)
  else if (scope.venueSlugs) q = q.in('bookings.courts.venue_slug', scope.venueSlugs)
  return q
}

// A failed or empty lookup just means "nothing outstanding": this is extra
// information, never a reason to break a page.
export function mapUnpaidShares(rows: any[] | null | undefined): UnpaidShareRow[] {
  return (rows ?? []).map((s: any) => ({
    id: s.id as string,
    amount: Number(s.amount_nzd) || 0,
    createdAt: s.created_at as string,
    date: s.bookings?.date as string,
    startTime: s.bookings?.start_time as string,
    courtName: (s.bookings?.courts?.name ?? 'Court') as string,
    venueSlug: (s.bookings?.courts?.venue_slug ?? '') as string,
    bookingStatus: (s.bookings?.status ?? '') as string,
    playerName: (s.debtor?.nickname ?? s.debtor?.full_name ?? 'A player') as string,
    organiserName: (s.organiser?.nickname ?? s.organiser?.full_name ?? null) as string | null,
  })).filter(s => s.date && s.venueSlug)
}
