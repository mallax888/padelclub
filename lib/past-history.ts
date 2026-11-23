// The Past tab on My bookings: every game that is over, newest first and grouped by month, each saying how it ended.
// Courts you booked and games you joined sit in one list. Pure (no clock, no fetching) so it is tested without a browser.
//   Paid $34.00 / Paid with credits / Membership   a game that was paid for
//   Cancelled                                       a booking that was cancelled
//   Nothing owed                                    a share (or booking) that was never paid before the game ended
export type PastOwn = { id: string; date: string; startTime: string; court: string; venueSlug: string | null; status: string; price: number; method: string; stripeId: string | null }
export type PastShare = { id: string; date: string; startTime: string; court: string; venueSlug: string | null; amount: number; from: string | null }
export type PastChip = { tone: 'paid' | 'cancelled' | 'nothing' | 'plain'; label: string; amount?: number }
export type PastItem = { key: string; date: string; startTime: string; court: string; venueSlug: string | null; note: string; chip: PastChip; paid: number }
export type PastMonth = { key: string; label: string; items: PastItem[]; paid: number; games: number }

const monthLabel = (date: string, withYear: boolean): string =>
  new Intl.DateTimeFormat('en-NZ', { timeZone: 'UTC', month: 'long', ...(withYear ? { year: 'numeric' } : {}) }).format(new Date(date + 'T12:00:00Z'))
const cents = (n: number) => Math.round(n * 100) / 100

export function buildPastHistory(input: { own: PastOwn[]; joinedPaid: PastShare[]; unpaid: PastShare[]; year?: string }): PastMonth[] {
  const items: PastItem[] = []
  for (const b of input.own) {
    if (b.method === 'staff_block' || b.status === 'blocked') continue
    const base = { key: `b-${b.id}`, date: b.date, startTime: b.startTime, court: b.court, venueSlug: b.venueSlug }
    if (b.status === 'cancelled') items.push({ ...base, note: 'Cancelled · you booked this', chip: { tone: 'cancelled', label: 'Cancelled' }, paid: 0 })
    else if (b.method === 'card' && b.stripeId) items.push({ ...base, note: 'You booked this', chip: { tone: 'paid', label: 'Paid', amount: b.price }, paid: b.price })
    else if (b.method === 'credits') items.push({ ...base, note: 'You booked this', chip: { tone: 'paid', label: 'Paid with credits' }, paid: 0 })
    else if (b.method === 'membership_allowance') items.push({ ...base, note: 'You booked this', chip: { tone: 'paid', label: 'Membership' }, paid: 0 })
    else items.push({ ...base, note: 'You booked this', chip: { tone: 'nothing', label: 'Nothing owed' }, paid: 0 })
  }
  const who = (from: string | null) => (from ? `Joined ${from}'s game · your share` : 'Joined a game · your share')
  for (const s of input.joinedPaid) items.push({ key: `p-${s.id}`, date: s.date, startTime: s.startTime, court: s.court, venueSlug: s.venueSlug, note: who(s.from), chip: { tone: 'paid', label: 'Paid', amount: s.amount }, paid: s.amount })
  for (const s of input.unpaid) items.push({ key: `u-${s.id}`, date: s.date, startTime: s.startTime, court: s.court, venueSlug: s.venueSlug, note: who(s.from), chip: { tone: 'nothing', label: 'Nothing owed' }, paid: 0 })

  items.sort((a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime) || a.key.localeCompare(b.key))
  // The year is only spelled out for months that are not in the current year (the caller's, else the newest game's).
  const newestYear = input.year ?? items[0]?.date.slice(0, 4)
  const months: PastMonth[] = []
  for (const it of items) {
    const key = it.date.slice(0, 7)
    let m = months[months.length - 1]
    if (!m || m.key !== key) { m = { key, label: monthLabel(it.date, it.date.slice(0, 4) !== newestYear), items: [], paid: 0, games: 0 }; months.push(m) }
    m.items.push(it)
    m.paid = cents(m.paid + it.paid)
    if (it.chip.tone === 'paid') m.games++
  }
  return months
}
