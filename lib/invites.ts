import { randomBytes } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getVenue } from '@/lib/venues'
import { currencyForRegion, type CurrencyCode } from '@/lib/currency'
import { timezoneForVenueSlug, venueInstant } from '@/lib/timezone'
import { formatDate } from '@/lib/utils'
import { TOKEN_PATTERN } from '@/lib/return-to'

// Postgres' "column does not exist" -- what every query touching invite_token
// raises until 023_invite_seats.sql has been run.
const UNDEFINED_COLUMN = '42703'

// A court holds four, and the booker is one of them.
export const MAX_INVITED_SEATS = 3

export const isInviteToken = (value: unknown): value is string =>
  typeof value === 'string' && TOKEN_PATTERN.test(value)

// 18 random bytes is 144 bits: not guessable, and short enough to read out of
// a WhatsApp message without it looking like a ransom note.
export const newInviteToken = () => randomBytes(18).toString('base64url')

export function isMissingInviteColumn(error: { code?: string; message?: string } | null | undefined) {
  return !!error && (error.code === UNDEFINED_COLUMN || /invite_token/.test(error.message ?? ''))
}

export type InviteState = 'open' | 'claimed' | 'expired' | 'cancelled'

export type InviteRecord = {
  splitId: string
  bookingId: string
  organiserId: string | null
  claimedBy: string | null
  seatStatus: string
  seatCount: number
  organiserName: string | null
  booking: {
    status: string
    date: string
    start_time: string
    end_time: string
    price_nzd: number
    user_id: string | null
    courtName: string | null
    venueSlug: string | null
  }
}

// Everything about an invite, by token. Server-only: it runs with the admin
// client because the person holding the link has no standing to read the
// booking -- they aren't on it yet. The token is the credential, so this is
// the one place that trades it for anything.
export async function loadInvite(
  admin: SupabaseClient<Database>,
  token: string,
): Promise<{ record: InviteRecord | null; featureMissing: boolean }> {
  if (!isInviteToken(token)) return { record: null, featureMissing: false }

  const { data, error } = await (admin.from('booking_splits') as any)
    .select(
      'id, booking_id, invited_by, user_id, status, ' +
      'bookings(status, date, start_time, end_time, price_nzd, user_id, courts(name, venue_slug)), ' +
      'organiser:profiles!booking_splits_invited_by_fkey(nickname, full_name)',
    )
    .eq('invite_token', token)
    .maybeSingle()

  if (isMissingInviteColumn(error)) return { record: null, featureMissing: true }
  if (error || !data || !data.booking_id || !data.bookings) return { record: null, featureMissing: false }

  const { count } = await admin
    .from('booking_splits')
    .select('id', { count: 'exact', head: true })
    .eq('booking_id', data.booking_id)

  const b = data.bookings
  const organiser = data.organiser
  return {
    featureMissing: false,
    record: {
      splitId: data.id,
      bookingId: data.booking_id,
      organiserId: data.invited_by ?? null,
      claimedBy: data.user_id ?? null,
      seatStatus: data.status,
      seatCount: (count ?? 0) + 1,
      organiserName: organiser?.nickname ?? organiser?.full_name?.split(' ')[0] ?? null,
      booking: {
        status: b.status,
        date: b.date,
        start_time: b.start_time,
        end_time: b.end_time,
        price_nzd: Number(b.price_nzd),
        user_id: b.user_id ?? null,
        courtName: b.courts?.name ?? null,
        venueSlug: b.courts?.venue_slug ?? null,
      },
    },
  }
}

export function inviteState(r: InviteRecord, now = new Date()): InviteState {
  if (r.booking.status === 'cancelled' || r.booking.status === 'blocked' || r.seatStatus === 'cancelled') {
    return 'cancelled'
  }
  if (r.claimedBy) return 'claimed'
  const startsAt = venueInstant(r.booking.date, r.booking.start_time, timezoneForVenueSlug(r.booking.venueSlug))
  return startsAt <= now ? 'expired' : 'open'
}

// The same share pay-split will charge: the court fee over every row on the
// booking plus the booker, worked out in cents. The row's own amount_nzd was
// written at booking time and pay-split overwrites it just before charging, so
// quoting the row here could be a cent off what the card is asked for.
export function inviteShare(r: InviteRecord): number {
  return Math.round((r.booking.price_nzd / r.seatCount) * 100) / 100
}

export type InvitePreview = {
  organiserName: string
  courtName: string
  venueName: string
  region: string
  dateLabel: string
  timeLabel: string
  share: number
  currency: CurrencyCode
  seatCount: number
}

export function invitePreview(r: InviteRecord): InvitePreview {
  const venue = r.booking.venueSlug ? getVenue(r.booking.venueSlug) : null
  return {
    organiserName: r.organiserName ?? 'A friend',
    courtName: r.booking.courtName ?? 'a court',
    venueName: venue?.name ?? 'the club',
    region: venue?.region ?? '',
    dateLabel: formatDate(r.booking.date),
    timeLabel: `${r.booking.start_time.slice(0, 5)}–${r.booking.end_time.slice(0, 5)}`,
    share: inviteShare(r),
    currency: currencyForRegion(venue?.region),
    seatCount: r.seatCount,
  }
}

export type ClaimResult =
  | { ok: true; record: InviteRecord; alreadyJoined: boolean }
  | { ok: false; status: number; error: string }

// Turns an invite seat into a real split by putting `userId` on it. Nothing is
// charged here: from this point it is an ordinary share, which shows in the
// person's My Bookings with a Pay button, goes through pay-split like any
// other, and is chased by the unpaid-share reminders.
//
// A function of its arguments rather than something done inside the route, so
// the cases that matter -- two people opening a forwarded link at once, a
// double-tap, a booker opening their own link -- can be tested against a fake
// database without a request, a session or a server.
export async function claimInvite(
  admin: SupabaseClient<Database>,
  userId: string,
  token: unknown,
): Promise<ClaimResult> {
  if (!isInviteToken(token)) return { ok: false, status: 404, error: "This invite link isn't valid." }

  const { record, featureMissing } = await loadInvite(admin, token)
  if (featureMissing) return { ok: false, status: 503, error: 'Invite links are not switched on yet.' }
  if (!record) return { ok: false, status: 404, error: "This invite link isn't valid." }

  const state = inviteState(record)

  // Opening the link twice, or double-tapping Join, must not turn into an error
  // for the person who already got the seat.
  if (state === 'claimed' && record.claimedBy === userId) {
    return { ok: true, record, alreadyJoined: true }
  }
  if (state === 'cancelled') return { ok: false, status: 410, error: 'This booking has been cancelled.' }
  if (state === 'claimed') return { ok: false, status: 409, error: 'Someone has already taken this spot.' }
  if (state === 'expired') return { ok: false, status: 410, error: 'This game has already started.' }
  if (record.booking.user_id === userId) return { ok: false, status: 400, error: 'This is your own booking.' }

  // Already holding another seat on this booking: a second one would count them
  // twice in the share and charge them for a place they can't use.
  const { data: already } = await admin
    .from('booking_splits')
    .select('id')
    .eq('booking_id', record.bookingId)
    .eq('user_id', userId)
    .neq('status', 'cancelled')
    .limit(1)
  if (already && already.length > 0) return { ok: false, status: 400, error: "You're already in this game." }

  // The seat goes to whichever request gets here first: the update only matches
  // while user_id is still null, so two people opening a forwarded link at once
  // can't both end up on it.
  const { data: claimed, error } = await admin
    .from('booking_splits')
    .update({ user_id: userId, amount_nzd: inviteShare(record) })
    .eq('id', record.splitId)
    .is('user_id', null)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()
  if (error) {
    console.error('Could not claim invite seat', record.splitId, error)
    return { ok: false, status: 500, error: 'Could not join the game. Please try again.' }
  }
  if (!claimed) return { ok: false, status: 409, error: 'Someone has already taken this spot.' }

  return { ok: true, record, alreadyJoined: false }
}

export type CreateSeatsResult =
  | { ok: true; created: number }
  | { ok: false; status: number; error: string; featureMissing?: boolean }

// Holds `count` seats open on a booking for friends who have no account yet.
//
// Each seat is a booking_splits row with no user and a token on it. The
// booker's own checkout divides the court fee by the number of rows on the
// booking, so creating these before that checkout is what makes the booker pay
// their real share rather than the whole court.
export async function createInviteSeats(
  admin: SupabaseClient<Database>,
  userId: string,
  input: { bookingId: unknown; count: unknown; totalSeats: unknown },
  now = new Date(),
): Promise<CreateSeatsResult> {
  const count = Number(input.count)
  if (typeof input.bookingId !== 'string' || !Number.isInteger(count) || count < 1 || count > MAX_INVITED_SEATS) {
    return { ok: false, status: 400, error: 'Invalid request' }
  }

  const { data: booking } = await admin
    .from('bookings')
    .select('id, user_id, status, date, start_time, price_nzd, courts(venue_slug)')
    .eq('id', input.bookingId)
    .maybeSingle()
  if (!booking) return { ok: false, status: 404, error: 'Booking not found' }
  if (booking.user_id !== userId) return { ok: false, status: 403, error: 'Not your booking' }
  if (booking.status === 'cancelled') return { ok: false, status: 400, error: 'This booking has been cancelled.' }

  const venueSlug = (booking.courts as any)?.venue_slug ?? null
  if (venueInstant(booking.date, booking.start_time, timezoneForVenueSlug(venueSlug)) <= now) {
    return { ok: false, status: 400, error: 'This game has already started.' }
  }

  // The court holds four. Counted against every row already on the booking, so
  // a second call can't take the booking past it.
  const { count: existing } = await admin
    .from('booking_splits')
    .select('id', { count: 'exact', head: true })
    .eq('booking_id', input.bookingId)
  if ((existing ?? 0) + count > MAX_INVITED_SEATS) {
    return { ok: false, status: 400, error: 'A court only holds four players.' }
  }

  // The share written on each seat. It is advisory -- pay-split recomputes the
  // real figure from the rows when somebody pays -- so a client that lies here
  // can make a seat read the wrong amount but cannot make anyone pay it. It
  // still needs to be right for the honest case: the registered splits aren't
  // on the booking yet when this runs, so the caller says how many shares the
  // court is being divided into, clamped to what is possible.
  const requested = Number(input.totalSeats)
  const shares = Math.min(4, Math.max((existing ?? 0) + count + 1, Number.isFinite(requested) ? requested : 0))
  const amount = Math.round((Number(booking.price_nzd) / shares) * 100) / 100

  const rows = Array.from({ length: count }, () => ({
    booking_id: input.bookingId as string,
    invited_by: userId,
    user_id: null,
    amount_nzd: amount,
    status: 'pending',
    invite_token: newInviteToken(),
  }))
  // One insert, so the seats are all created or none are -- a booking never
  // ends up holding two of the three the booker asked for.
  const { error } = await admin.from('booking_splits').insert(rows)
  if (isMissingInviteColumn(error)) {
    return { ok: false, status: 503, error: 'Invite links are not switched on yet.', featureMissing: true }
  }
  if (error) {
    console.error('Could not create invite seats for', input.bookingId, error)
    return { ok: false, status: 500, error: 'Could not create the invite links.' }
  }
  return { ok: true, created: count }
}
