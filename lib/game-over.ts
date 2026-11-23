// Once a game is over nothing is owed on it: a share is either paid or it is not owed at all (a share that was paid
// is refunded if the booking is cancelled). So an unpaid share on a finished game never shows as owed, to the friend
// or to the organiser. Pure: the clock is passed in.
import { timezoneForVenueSlug, venueInstant } from '@/lib/timezone'

export function gameHasEnded(date: string, endTime: string | null | undefined, venueSlug: string | null | undefined, nowMs: number): boolean {
  if (!date || !endTime) return false
  const t = String(endTime)
  return venueInstant(date, t.length === 5 ? `${t}:00` : t, timezoneForVenueSlug(venueSlug)).getTime() <= nowMs
}
