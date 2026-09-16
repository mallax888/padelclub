import { getVenue } from '@/lib/venues'

// A booking stores a plain date ('2026-09-20') and a plain time ('19:00:00')
// meaning the wall clock at the court. That's the right thing to store -- 7pm
// at an Auckland court is 7pm whatever the server is doing -- but it isn't a
// moment in time on its own, and any code that needs one has to say which
// clock the wall time belongs to.
//
// Doing it the obvious way is wrong:
//
//   new Date(`${date}T${start_time}`)
//
// An ISO string with no offset is parsed in the *runtime's* zone, which on
// Vercel is UTC. So 7pm at an Auckland court came out as 7pm UTC -- twelve
// hours after the game actually starts. That put the 24-hour refund boundary
// twelve hours out (anyone cancelling between 12 and 24 hours before play was
// handed a full refund the policy says should be 50%), let reschedules
// through inside the locked window, and fired the "court time in 2 hours"
// push about ten hours after the game had finished.
//
// Every venue in a country shares a zone except in Australia, which spans
// four, so the mapping is per region rather than per venue.
const REGION_TIMEZONES: Record<string, string> = {
  // New Zealand
  Auckland: 'Pacific/Auckland',
  Wellington: 'Pacific/Auckland',
  Christchurch: 'Pacific/Auckland',
  // South Africa -- one zone nationwide, no DST
  Nelspruit: 'Africa/Johannesburg',
  Johannesburg: 'Africa/Johannesburg',
  'Cape Town': 'Africa/Johannesburg',
  Durban: 'Africa/Johannesburg',
  Pretoria: 'Africa/Johannesburg',
  // Australia -- four distinct zones; Brisbane and Perth don't observe DST
  Sydney: 'Australia/Sydney',
  Melbourne: 'Australia/Melbourne',
  Brisbane: 'Australia/Brisbane',
  Perth: 'Australia/Perth',
}

// Falls back to Auckland rather than to the server's zone: a new region added
// to lib/venues.ts without a line above should behave like the rest of the
// app's home country, not silently revert to the UTC bug this file exists to
// fix.
const DEFAULT_TIMEZONE = 'Pacific/Auckland'

export function timezoneForRegion(region: string | undefined): string {
  return (region && REGION_TIMEZONES[region]) || DEFAULT_TIMEZONE
}

export function timezoneForVenueSlug(venueSlug: string | null | undefined): string {
  if (!venueSlug) return DEFAULT_TIMEZONE
  return timezoneForRegion(getVenue(venueSlug).region)
}

// How far ahead of UTC `timeZone` is at this instant, in milliseconds.
// Formatting the instant into the zone and reading the fields back is the
// only way to get this without pulling in a timezone library, and it stays
// correct across DST because it asks about one specific instant.
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant)
  const field = (type: string) => Number(parts.find(p => p.type === type)?.value ?? 0)
  // hour12:false renders midnight as '24' in some engines, hence % 24.
  const asIfUtc = Date.UTC(
    field('year'), field('month') - 1, field('day'),
    field('hour') % 24, field('minute'), field('second'),
  )
  return asIfUtc - instant.getTime()
}

// The actual moment a booking starts, given the court's wall clock.
//
//   venueInstant('2026-09-20', '19:00:00', 'Pacific/Auckland')
//     -> 2026-09-20T07:00:00Z
export function venueInstant(dateStr: string, timeStr: string, timeZone: string): Date {
  const [y, mo, d] = dateStr.split('-').map(Number)
  const [h, mi, s] = timeStr.split(':').map(Number)
  const wallAsUtc = Date.UTC(y, mo - 1, d, h || 0, mi || 0, s || 0)

  // Guess the offset using the wall time read as UTC, then correct. A second
  // pass settles the handful of hours a year where the first guess lands on
  // the other side of a DST change and picks up the wrong offset.
  const firstGuess = zoneOffsetMs(new Date(wallAsUtc), timeZone)
  const candidate = new Date(wallAsUtc - firstGuess)
  const settled = zoneOffsetMs(candidate, timeZone)
  return settled === firstGuess ? candidate : new Date(wallAsUtc - settled)
}

// Hours from now until a booking starts -- the figure the 24-hour refund and
// reschedule rules are measured against.
export function hoursUntilBooking(
  dateStr: string,
  timeStr: string,
  venueSlug: string | null | undefined,
): number {
  const startsAt = venueInstant(dateStr, timeStr, timezoneForVenueSlug(venueSlug))
  return (startsAt.getTime() - Date.now()) / (1000 * 60 * 60)
}
