// The numbers behind the manager "Today" screen, worked out from a club's
// bookings for today and the same day last week. Pure functions of their inputs
// (the clock is passed in), so they can be tested without a browser or database.
import { timezoneForVenueSlug } from '@/lib/timezone'

const pad = (n: number) => String(n).padStart(2, '0')

export type TodayBooking = {
  id: string
  user_id: string | null
  court_id: string
  date: string
  start_time: string
  end_time: string
  status: string
  price_nzd: number
  bookerName: string | null
}
export type TodaySplit = { booking_id: string; user_id: string | null; status: string }
export type TodayCourt = { id: string; name: string; is_active?: boolean | null }

// "Now" at a club: its own date and minutes since midnight, whatever timezone
// the server happens to run in.
export function venueClock(venueSlug: string, nowMs: number): { date: string; minutes: number; hour: number } {
  const tz = timezoneForVenueSlug(venueSlug)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(nowMs))
  const get = (t: string) => parts.find(p => p.type === t)!.value
  const hour = Number(get('hour')) % 24
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: hour * 60 + Number(get('minute')), hour }
}

export function addDaysStr(d: string, n: number): string {
  const t = new Date(d + 'T00:00:00Z')
  t.setUTCDate(t.getUTCDate() + n)
  return t.toISOString().slice(0, 10)
}

const minutesOf = (t: string) => parseInt(t.slice(0, 2), 10) * 60 + parseInt(t.slice(3, 5), 10)
const hhmm = (t: string) => t.slice(0, 5)
const live = (b: TodayBooking) => b.status !== 'cancelled' && b.status !== 'blocked'

export type CourtNow = { id: string; name: string; state: 'inUse' | 'free' | 'blocked'; until: string | null; next: string | null }
export type NextUp = {
  id: string
  start: string
  courtName: string
  bookerName: string | null
  players: number
  unpaid: number // joined friends who haven't paid, plus the booker if their own payment is still pending
}
export type TodaySummary = {
  bookings: { today: number; lastWeek: number; remaining: number } // remaining: not finished yet
  players: { today: number; lastWeek: number }
  revenue: { today: number; lastWeek: number }
  courts: CourtNow[]
  nextUp: NextUp[]
}

// A person counts once per day however many courts they are on: the booker plus
// every friend who has joined (a seat nobody has taken yet isn't a player).
function playersOn(bookings: TodayBooking[], splits: TodaySplit[]): number {
  const ids = new Set<string>()
  const byId = new Set(bookings.filter(live).map(b => b.id))
  for (const b of bookings) if (live(b) && b.user_id) ids.add(b.user_id)
  for (const s of splits) if (byId.has(s.booking_id) && s.user_id && s.status !== 'cancelled') ids.add(s.user_id)
  return ids.size
}

export function computeToday(
  input: { courts: TodayCourt[]; bookings: TodayBooking[]; splits: TodaySplit[]; today: string; nowMinutes: number },
  maxNext = 4,
): TodaySummary {
  const { courts, bookings, splits, today, nowMinutes } = input
  const lastWeekDate = addDaysStr(today, -7)
  const todays = bookings.filter(b => b.date === today)
  const lastWeeks = bookings.filter(b => b.date === lastWeekDate)

  // Revenue is what the Dashboard already calls revenue: confirmed bookings.
  const revenue = (list: TodayBooking[]) => Math.round(list.filter(b => b.status === 'confirmed').reduce((a, b) => a + (Number(b.price_nzd) || 0), 0) * 100) / 100

  const courtsNow: CourtNow[] = courts.filter(c => c.is_active !== false).map(c => {
    const mine = todays.filter(b => b.court_id === c.id && b.status !== 'cancelled')
    const current = mine.find(b => minutesOf(b.start_time) <= nowMinutes && minutesOf(b.end_time) > nowMinutes)
    const upcoming = mine.filter(b => b.status !== 'blocked' && minutesOf(b.start_time) > nowMinutes).sort((a, b) => minutesOf(a.start_time) - minutesOf(b.start_time))[0]
    return {
      id: c.id,
      name: c.name,
      state: current ? (current.status === 'blocked' ? 'blocked' : 'inUse') : 'free',
      until: current ? hhmm(current.end_time) : null,
      next: upcoming ? hhmm(upcoming.start_time) : null,
    }
  })

  const courtName = new Map(courts.map(c => [c.id, c.name]))
  const nextUp: NextUp[] = todays
    .filter(b => live(b) && minutesOf(b.end_time) > nowMinutes)
    .sort((a, b) => minutesOf(a.start_time) - minutesOf(b.start_time))
    .slice(0, maxNext)
    .map(b => {
      const joined = splits.filter(s => s.booking_id === b.id && s.user_id && s.status !== 'cancelled')
      const unpaidFriends = joined.filter(s => s.status === 'pending').length
      return {
        id: b.id,
        start: hhmm(b.start_time),
        courtName: courtName.get(b.court_id) ?? 'Court',
        bookerName: b.bookerName,
        players: 1 + joined.length,
        unpaid: unpaidFriends + (b.status === 'pending' ? 1 : 0),
      }
    })

  return {
    bookings: { today: todays.filter(live).length, lastWeek: lastWeeks.filter(live).length, remaining: todays.filter(b => live(b) && minutesOf(b.end_time) > nowMinutes).length },
    players: { today: playersOn(todays, splits), lastWeek: playersOn(lastWeeks, splits) },
    revenue: { today: revenue(todays), lastWeek: revenue(lastWeeks) },
    courts: courtsNow,
    nextUp,
  }
}

export const greetingFor = (hour: number) => (hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening')
export { pad }
