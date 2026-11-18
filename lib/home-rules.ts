// The rules behind the player Home screen, as pure functions (no database, no clock of
// their own): which booking is next, what a player's "usual" slot is, how much a membership
// has saved them lately, who has paid their share. The page just feeds these what it loaded.
import { timezoneForVenueSlug, venueInstant } from '@/lib/timezone'

export type HomeBooking = {
  id: string
  date: string
  start_time: string
  end_time?: string | null
  duration_minutes?: number | null
  status: string
  price_nzd: number
  discount_applied?: number | null
  courts?: { id?: string; name?: string | null; type?: string | null; venue_slug?: string | null } | null
}

const hhmm = (t: string): string => String(t).slice(0, 5)
const venueOf = (b: HomeBooking): string | null => b.courts?.venue_slug ?? null
const startMs = (b: HomeBooking): number => {
  const slug = venueOf(b)
  return venueInstant(b.date, `${hhmm(b.start_time)}:00`, slug ? timezoneForVenueSlug(slug) : 'UTC').getTime()
}

export const greetingFor = (hour: number): string => (hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening')

// The soonest confirmed booking that has not started.
export function nextGame<B extends HomeBooking>(bookings: B[], nowMs: number): B | null {
  const coming = bookings.filter(b => b.status === 'confirmed' && startMs(b) > nowMs).sort((a, b) => startMs(a) - startMs(b))
  return coming[0] ?? null
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const weekdayIndex = (date: string): number => new Date(date + 'T12:00:00Z').getUTCDay()

export type Usual = {
  weekday: number
  weekdayName: string
  startTime: string // HH:MM
  venueSlug: string
  courtName: string
  durationMin: number
  price: number
  times: number
}

export const USUAL_MIN_TIMES = 2
export const USUAL_WINDOW_DAYS = 120

// The slot someone books again and again: the same weekday, start time, club and length,
// played at least twice in the last four months. The most repeated wins; a tie goes to the
// one played most recently. Returns null when nothing repeats, so a new player is not shown
// a "usual" they do not have.
export function usualOf(bookings: HomeBooking[], nowMs: number): Usual | null {
  const since = nowMs - USUAL_WINDOW_DAYS * 86400000
  const groups = new Map<string, { b: HomeBooking; n: number; last: number }>()
  for (const b of bookings) {
    const slug = venueOf(b)
    if (!slug || (b.status !== 'confirmed' && b.status !== 'completed')) continue
    const at = startMs(b)
    if (at >= nowMs || at < since) continue
    const dur = Math.round(b.duration_minutes ?? 60)
    const key = `${weekdayIndex(b.date)}|${hhmm(b.start_time)}|${slug}|${dur}`
    const g = groups.get(key)
    if (!g) groups.set(key, { b, n: 1, last: at })
    else { g.n++; if (at >= g.last) { g.last = at; g.b = b } }
  }
  const best = Array.from(groups.values()).filter(g => g.n >= USUAL_MIN_TIMES).sort((x, y) => y.n - x.n || y.last - x.last)[0]
  if (!best) return null
  const b = best.b
  return {
    weekday: weekdayIndex(b.date), weekdayName: WEEKDAYS[weekdayIndex(b.date)], startTime: hhmm(b.start_time), venueSlug: venueOf(b)!,
    courtName: b.courts?.name ?? 'Court', durationMin: Math.round(b.duration_minutes ?? 60), price: Number(b.price_nzd) || 0, times: best.n,
  }
}

// The next date this usual slot could be booked: the first matching weekday that has not
// started yet.
export function nextOccurrence(u: Pick<Usual, 'weekday' | 'startTime' | 'venueSlug'>, nowMs: number): string {
  const tz = timezoneForVenueSlug(u.venueSlug)
  const today = new Date(nowMs)
  for (let i = 0; i < 9; i++) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + i, 12))
    if (d.getUTCDay() !== u.weekday) continue
    const date = d.toISOString().slice(0, 10)
    if (venueInstant(date, `${u.startTime}:00`, tz).getTime() > nowMs) return date
  }
  return new Date(nowMs + 7 * 86400000).toISOString().slice(0, 10)
}

// What a membership discount took off the player's bookings over the last 30 days, in whole
// dollars: the list price (price / (1 - discount)) minus what they paid.
export function savedLast30(bookings: HomeBooking[], nowMs: number): number {
  const since = nowMs - 30 * 86400000
  let saved = 0
  for (const b of bookings) {
    if (b.status !== 'confirmed' && b.status !== 'completed') continue
    const d = Number(b.discount_applied) || 0
    if (d <= 0 || d >= 1) continue
    const at = startMs(b)
    if (at > nowMs || at < since) continue
    saved += Number(b.price_nzd) / (1 - d) - Number(b.price_nzd)
  }
  return Math.round(saved)
}

export type ShareRow = { status: string; name: string }
// Who has paid their share of a split booking and who has not yet.
export function shareSummary(rows: ShareRow[]): { paid: string[]; waiting: string[] } {
  const live = rows.filter(r => r.status === 'paid' || r.status === 'pending')
  return { paid: live.filter(r => r.status === 'paid').map(r => r.name), waiting: live.filter(r => r.status === 'pending').map(r => r.name) }
}

// "Sam paid" / "Jo hasn't paid yet" chips for the next-game card.
export function shareChips(s: { paid: string[]; waiting: string[] }): { text: string; paid: boolean }[] {
  const chips: { text: string; paid: boolean }[] = []
  if (s.paid.length > 0) chips.push({ text: `${s.paid.join(' and ')} paid`, paid: true })
  if (s.waiting.length > 0) chips.push({ text: `${s.waiting.join(' and ')} ${s.waiting.length === 1 ? "hasn't" : "haven't"} paid yet`, paid: false })
  return chips
}

export const mapsUrl = (address: string): string => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`

// Where "Book again" opens on the Book page: that club, that day and that length, with the
// time left as the one tap.
export const usualLink = (u: Usual, date: string): string =>
  `/book?wl=1&u=${encodeURIComponent(u.venueSlug)}&ud=${date}&um=${u.durationMin}`

// "In 21 hrs", "In 40 min", "In 3 days": how long until a game starts, for the next-game ticket.
export function countdownLabel(b: HomeBooking, nowMs: number): string {
  const mins = Math.max(0, Math.round((startMs(b) - nowMs) / 60000))
  if (mins < 60) return `In ${Math.max(1, mins)} min`
  const hrs = Math.round(mins / 60)
  if (hrs < 36) return `In ${hrs} ${hrs === 1 ? 'hr' : 'hrs'}`
  const days = Math.round(mins / 1440)
  return `In ${days} days`
}

// Whole days since 1970-01-01 for a YYYY-MM-DD date, and the Monday-to-Sunday week it falls in.
const dayNumber = (date: string): number => Math.floor(new Date(date + 'T00:00:00Z').getTime() / 86400000)
const weekNumber = (date: string): number => Math.floor((dayNumber(date) + 3) / 7)

// The "Your month" tiles on Home: games played so far this calendar month, and how many weeks
// in a row they have played (this week counts when they have already played in it; if they
// have not yet, the run is judged up to last week, so a quiet Monday does not reset it).
// `today` is the player's local date (YYYY-MM-DD) at their club.
export function monthSummary(bookings: HomeBooking[], nowMs: number, today: string): { games: number; weeks: number } {
  const played = bookings.filter(b => (b.status === 'confirmed' || b.status === 'completed') && startMs(b) <= nowMs)
  const games = played.filter(b => b.date.slice(0, 7) === today.slice(0, 7)).length
  const weeksPlayed = new Set(played.map(b => weekNumber(b.date)))
  let w = weekNumber(today)
  if (!weeksPlayed.has(w)) w -= 1
  let weeks = 0
  while (weeksPlayed.has(w)) { weeks++; w-- }
  return { games, weeks }
}

// How many different people the player has been on court with.
export const distinctPeople = (ids: (string | null | undefined)[], selfId: string): number =>
  new Set(ids.filter((x): x is string => !!x && x !== selfId)).size

// Which heading a booking sits under on My bookings: this week (Monday to Sunday), next week, or later.
export function weekGroup(date: string, today: string): 'This week' | 'Next week' | 'Later' {
  const d = weekNumber(date) - weekNumber(today)
  return d <= 0 ? 'This week' : d === 1 ? 'Next week' : 'Later'
}
