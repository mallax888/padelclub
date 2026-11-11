// A club's opening hours: a week of "open to close" per day, or closed. Pure
// functions (client-safe, no server imports) used by the booking flow, the Board,
// the empty-hours numbers and the setup screen, so they all agree on what "open"
// means. A club that has never set hours is read as 07:00-22:00 every day, which
// is what the whole app assumed before hours existed.

export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export type DayKey = typeof DAY_KEYS[number]
export type DayHours = { open: string; close: string } | null // null = closed
export type WeekHours = Record<DayKey, DayHours>

export const DAY_NAMES: Record<DayKey, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' }
export const DAY_PLURALS: Record<DayKey, string> = { mon: 'Mondays', tue: 'Tuesdays', wed: 'Wednesdays', thu: 'Thursdays', fri: 'Fridays', sat: 'Saturdays', sun: 'Sundays' }
export const DEFAULT_OPEN = '07:00'
export const DEFAULT_CLOSE = '22:00'

export const defaultWeek = (): WeekHours => {
  const w = {} as WeekHours
  for (const d of DAY_KEYS) w[d] = { open: DEFAULT_OPEN, close: DEFAULT_CLOSE }
  return w
}

const TIME_RE = /^(?:[01]\d|2[0-3]):(?:00|30)$|^24:00$/
export const toMinutes = (t: string): number => parseInt(t.slice(0, 2), 10) * 60 + parseInt(t.slice(3, 5), 10)
export const fromMinutes = (m: number): string => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

// Half-hour steps from 05:00 to 24:00: what the pickers offer, and what is accepted.
export const TIME_CHOICES: string[] = Array.from({ length: 39 }, (_, i) => fromMinutes(300 + i * 30))

export type WeekResult = { hours: WeekHours } | { error: string }

export function validateWeek(raw: unknown): WeekResult {
  const o = raw as any
  if (!o || typeof o !== 'object') return { error: 'Opening hours are missing.' }
  const hours = {} as WeekHours
  let anyOpen = false
  for (const d of DAY_KEYS) {
    const v = o[d]
    if (v === null) { hours[d] = null; continue }
    if (!v || typeof v.open !== 'string' || typeof v.close !== 'string') return { error: `Check the hours for ${DAY_NAMES[d]}.` }
    if (!TIME_RE.test(v.open) || !TIME_RE.test(v.close) || v.open === '24:00') return { error: `Check the hours for ${DAY_NAMES[d]}.` }
    if (toMinutes(v.open) >= toMinutes(v.close)) return { error: `${DAY_NAMES[d]} must close after it opens.` }
    hours[d] = { open: v.open, close: v.close }
    anyOpen = true
  }
  if (!anyOpen) return { error: 'Open on at least one day.' }
  return { hours }
}

// Whatever came out of the database: valid hours, or null.
export function parseWeek(raw: unknown): WeekHours | null {
  const r = validateWeek(raw)
  return 'hours' in r ? r.hours : null
}

export const weekOrDefault = (w: WeekHours | null | undefined): WeekHours => w ?? defaultWeek()

export function dayKeyOfDate(dateStr: string): DayKey {
  const dow = new Date(dateStr + 'T12:00:00Z').getUTCDay() // 0 = Sunday
  return DAY_KEYS[(dow + 6) % 7]
}

export const dayHours = (w: WeekHours | null | undefined, dateStr: string): DayHours => weekOrDefault(w)[dayKeyOfDate(dateStr)]

// Start times offered for a day: from opening, every `interval` minutes, up to
// (not including) closing. Same shape the old fixed 07:00-22:00 list had.
export function slotTimes(day: DayHours, intervalMinutes: number): string[] {
  if (!day) return []
  const out: string[] = []
  for (let m = toMinutes(day.open); m < toMinutes(day.close) && m < 24 * 60; m += intervalMinutes) out.push(fromMinutes(m))
  return out
}

// The earliest opening and latest closing across the week, in whole hours
// (rounded outwards): the rows a grid for the whole week needs.
export function weekBounds(w: WeekHours | null | undefined): { firstHour: number; lastHour: number } {
  let first = 24 * 60, last = 0
  for (const d of DAY_KEYS) {
    const h = weekOrDefault(w)[d]
    if (!h) continue
    first = Math.min(first, toMinutes(h.open)); last = Math.max(last, toMinutes(h.close))
  }
  if (last === 0) return { firstHour: 7, lastHour: 22 }
  return { firstHour: Math.floor(first / 60), lastHour: Math.ceil(last / 60) }
}

// "Mon-Fri 06:00-22:00", "Sat 07:00-21:00", "Sun closed": consecutive days with
// identical hours are grouped.
export function describeWeek(w: WeekHours | null | undefined): string[] {
  const week = weekOrDefault(w)
  const label = (h: DayHours) => (h ? `${h.open}–${h.close}` : 'closed')
  const lines: string[] = []
  let i = 0
  while (i < DAY_KEYS.length) {
    let j = i
    while (j + 1 < DAY_KEYS.length && label(week[DAY_KEYS[j + 1]]) === label(week[DAY_KEYS[i]])) j++
    lines.push(`${i === j ? DAY_NAMES[DAY_KEYS[i]] : `${DAY_NAMES[DAY_KEYS[i]]}–${DAY_NAMES[DAY_KEYS[j]]}`} ${label(week[DAY_KEYS[i]])}`)
    i = j + 1
  }
  return lines
}
