import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

// formatNzd used to live here. It rendered every amount through en-NZ, which
// prints a bare "$37.00" -- indistinguishable from A$ or R to the member
// reading it, and wrong outright for the two thirds of this app's venues that
// don't charge in New Zealand dollars. Use formatPrice from lib/currency
// instead and pass the currency: currencyForRegion(venue.region) for anything
// derived from a court's price, or 'nzd' explicitly for the membership and
// credit-pack price list, which is one global list in NZD.

// Every date the app shows a person goes through one of the three helpers
// below, so the same day never reads as "Tue, 22 Sept" in one place and
// "2026-09-22" or "Monday, 22 September" in another.
//
// Accepts either a date column ('2026-09-22') or a full timestamp
// ('2026-09-22T09:30:00Z'). A bare date is pinned to local midnight rather
// than parsed as UTC, which would otherwise render as the previous day for
// any timezone ahead of UTC -- i.e. every region this app runs in.
function toDate(value: string): Date {
  return new Date(value.length === 10 ? `${value}T00:00:00` : value)
}

// "Tue, 22 Sept" -- the default for anything happening soon enough that the
// year is obvious: bookings, matches, the board.
export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('en-NZ', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(toDate(dateStr))
}

// "Tue 22" -- for date pickers that show a run of consecutive days with the
// full date spelled out alongside, where repeating the month seven times
// costs room without telling the reader anything.
export function formatDateCompact(dateStr: string): string {
  return new Intl.DateTimeFormat('en-NZ', {
    weekday: 'short',
    day: 'numeric',
  }).format(toDate(dateStr))
}

// "22 Sept 2026" -- for dates far enough back that the year carries meaning
// (joined, member since, transaction history). No weekday: nobody needs to
// know which day of the week someone signed up.
export function formatDateWithYear(dateStr: string): string {
  return new Intl.DateTimeFormat('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(toDate(dateStr))
}

// new Date().toISOString().slice(0, 10) is a common but wrong way to get
// "today" -- toISOString() converts to UTC first, so for any timezone ahead
// of UTC (all of NZ/AU/SA) it returns yesterday's date for a chunk of every
// day. This builds the date string from the Date object's own local
// getFullYear/getMonth/getDate instead, which always matches the calendar
// date the browser's clock is actually showing.
export function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function getNextNDates(n: number): string[] {
  const dates: string[] = []
  const now = new Date()
  for (let i = 0; i < n; i++) {
    const d = new Date(now)
    d.setDate(now.getDate() + i)
    dates.push(localDateStr(d))
  }
  return dates
}
export function generateTimeSlots(
  openHour = 7,
  closeHour = 22,
  intervalMinutes = 60
): string[] {
  const slots: string[] = []
  for (let h = openHour; h < closeHour; h += intervalMinutes / 60) {
    const hh = Math.floor(h).toString().padStart(2, '0')
    const mm = ((h % 1) * 60).toString().padStart(2, '0')
    slots.push(`${hh}:${mm}`)
  }
  return slots
}

export function addHours(timeStr: string, hours: number): string {
  const [h, m] = timeStr.split(':').map(Number)
  const total = h + hours
  return `${total.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

export function getInitials(name: string | null): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}
