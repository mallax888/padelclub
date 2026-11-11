// The rules of the waitlist, as pure functions (client-safe, no server imports):
// what makes a time "full", which waits a freed court-time satisfies, and the
// demand figures shown to owners. Used by the join route, the notifier that runs
// when a court frees up, and the booking flow itself, so they all agree.

export const MAX_ACTIVE_WAITS = 5
export const RENOTIFY_AFTER_MS = 30 * 60 * 1000
export const DEMAND_DAYS = 14
export const WAIT_DURATIONS = [30, 60, 90, 120] as const

export const toMin = (t: string): number => parseInt(t.slice(0, 2), 10) * 60 + parseInt(t.slice(3, 5), 10)
export const hhmm = (t: string): string => t.slice(0, 5)

// Half-open ranges [start, start+dur): back-to-back bookings don't overlap.
export const overlaps = (aStart: number, aDur: number, bStart: number, bDur: number): boolean =>
  aStart < bStart + bDur && bStart < aStart + aDur

export type BusyBooking = { court_id: string; start_time: string; duration_minutes: number | null }

// A time is full when every court has a booking (or block) overlapping it. No
// courts at all isn't "full" -- there's nothing to wait for.
export function isSlotFull(courtIds: string[], busy: BusyBooking[], startMin: number, durationMin: number): boolean {
  if (courtIds.length === 0) return false
  return courtIds.every(id =>
    busy.some(b => b.court_id === id && overlaps(toMin(b.start_time), b.duration_minutes ?? 60, startMin, durationMin)))
}

export type WaitRow = {
  id: string
  user_id: string
  venue_slug: string
  date: string
  start_time: string
  duration_minutes: number
  status: 'waiting' | 'notified' | 'cancelled' | string
  notified_at: string | null
  created_at?: string
}

// Which waits should be told that court-time has just been freed. A wait counts
// when it overlaps the freed time and has not been told recently; whether a court
// is genuinely free for its whole length is checked by the caller (isSlotFull).
export function waitsWorthChecking(
  waits: WaitRow[],
  freed: { venueSlug: string; date: string; startMin: number; durationMin: number },
  nowMs: number,
): WaitRow[] {
  return waits.filter(w => {
    if (w.venue_slug !== freed.venueSlug || w.date !== freed.date) return false
    if (!overlaps(toMin(w.start_time), w.duration_minutes, freed.startMin, freed.durationMin)) return false
    if (w.status === 'waiting') return true
    if (w.status === 'notified') return !!w.notified_at && nowMs - Date.parse(w.notified_at) >= RENOTIFY_AFTER_MS
    return false
  })
}

export type DemandBooking = { user_id: string; court_venue: string; date: string; start_time: string; duration_minutes: number | null; created_at: string; status: string }
export type DemandSlot = { weekday: number; time: string; waits: number }
export type WaitDemand = { total: number; bookedAfter: number; slots: DemandSlot[] }

// Owner view: how many people waited for a full time in the last two weeks, how
// many of them then booked it (a booking that overlaps their wait, made after
// they were told), and the times people most often can't get.
export function aggregateDemand(waits: WaitRow[], bookings: DemandBooking[], nowMs: number, days = DEMAND_DAYS): WaitDemand {
  const since = nowMs - days * 24 * 3600 * 1000
  const recent = waits.filter(w => w.created_at && Date.parse(w.created_at) >= since)
  const by = new Map<string, DemandSlot>()
  let bookedAfter = 0
  for (const w of recent) {
    const weekday = (new Date(w.date + 'T12:00:00Z').getUTCDay() + 6) % 7 // Mon = 0
    const key = `${weekday}-${hhmm(w.start_time)}`
    const cur = by.get(key) ?? { weekday, time: hhmm(w.start_time), waits: 0 }
    cur.waits++
    by.set(key, cur)
    if (w.notified_at) {
      const told = Date.parse(w.notified_at)
      const got = bookings.some(b => b.user_id === w.user_id && b.court_venue === w.venue_slug && b.date === w.date && b.status !== 'cancelled' &&
        Date.parse(b.created_at) >= told && overlaps(toMin(b.start_time), b.duration_minutes ?? 60, toMin(w.start_time), w.duration_minutes))
      if (got) bookedAfter++
    }
  }
  const slots = Array.from(by.values()).sort((a, b) => b.waits - a.waits || a.weekday - b.weekday || (a.time < b.time ? -1 : 1)).slice(0, 5)
  return { total: recent.length, bookedAfter, slots }
}
