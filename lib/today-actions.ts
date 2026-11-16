// What the "Fill them" and "Remind all" buttons on Today act on. Pure rules (no database, no React) so they are
// tested on their own.
import { bestSlotsToFill, type SlotDemand } from '@/lib/money-demand'
import { MIN_LEAD_HOURS } from '@/lib/offer-rules'
import { venueInstant } from '@/lib/timezone'

export type FillGap = { date: string; from: string; to: string; courtsFree: number }

// The best hour to offer today: busy times first, then whatever earns most. An offer needs at least
// MIN_LEAD_HOURS of notice (players have to see it and book), so an hour that starts sooner is not offered.
// Null when nothing is left to offer.
export function pickFillSlot(slots: SlotDemand[], nowMs: number, timeZone: string): FillGap | null {
  const earliest = nowMs + MIN_LEAD_HOURS * 3600 * 1000
  const offerable = slots.filter(s => s.empty > 0 && venueInstant(s.date, s.from.length === 5 ? `${s.from}:00` : s.from, timeZone).getTime() >= earliest)
  const best = bestSlotsToFill(offerable.filter(s => s.kind === 'peak'), 1)[0] ?? bestSlotsToFill(offerable, 1)[0]
  return best ? { date: best.date, from: best.from, to: best.to, courtsFree: best.empty } : null
}

export type OverdueLine = { id: string; playerName: string; organiserName: string | null; courtName: string; date: string; startTime: string; amount: number }

// What "Remind all" will do, in words: each friend who owes gets a nudge, and so does the person who booked.
export function reminderCounts(lines: OverdueLine[]): { friends: number; organisers: number } {
  const organisers = new Set(lines.map(l => (l.organiserName ?? '').trim().toLowerCase()).filter(Boolean))
  return { friends: lines.length, organisers: organisers.size }
}
export const reminderButton = (c: { friends: number; organisers: number }): string =>
  `Remind ${c.friends} ${c.friends === 1 ? 'friend' : 'friends'}${c.organisers > 0 ? ` and ${c.organisers} ${c.organisers === 1 ? 'organiser' : 'organisers'}` : ''}`
