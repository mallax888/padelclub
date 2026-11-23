// How the "Offers you've sent" card groups what the owner has sent: live offers stay at the top and big,
// closed offers from the last week sit below as single lines, and anything older folds away behind one line.
// Pure (the date is passed in) so it can be tested without a browser or a clock.

export const RECENT_OFFER_DAYS = 7

const dayNumber = (date: string): number => {
  const [y, m, d] = date.split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
}

export function splitOffers<O extends { date: string; ended: boolean }>(
  offers: O[],
  today: string,
  recentDays: number = RECENT_OFFER_DAYS,
): { live: O[]; recent: O[]; earlier: O[] } {
  const live: O[] = [], recent: O[] = [], earlier: O[] = []
  const cutoff = dayNumber(today) - recentDays
  for (const o of offers) {
    if (!o.ended) live.push(o)
    else if (dayNumber(o.date) >= cutoff) recent.push(o)
    else earlier.push(o)
  }
  return { live, recent, earlier }
}

// "Told 6 players · 2 courts booked · earned $128.00 · 1 new", or "Told 2 players · no bookings".
export function closedOfferLine(o: { told_count: number; status: string; results: { courtsBooked: number; newPlayers: number } }, earned: string): string {
  const told = `Told ${o.told_count} ${o.told_count === 1 ? 'player' : 'players'}`
  const how = o.status === 'cancelled' ? 'ended early' : null
  if (o.results.courtsBooked === 0) return [told, how, 'no bookings'].filter(Boolean).join(' · ')
  const courts = `${o.results.courtsBooked} ${o.results.courtsBooked === 1 ? 'court' : 'courts'} booked`
  const fresh = o.results.newPlayers > 0 ? `${o.results.newPlayers} new` : null
  return [told, how, courts, `earned ${earned}`, fresh].filter(Boolean).join(' · ')
}
