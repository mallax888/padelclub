export type Special = {
  id: string
  venueSlug: string
  partnerName: string
  address?: string
  website?: string
  title: string
  blurb: string
  howToRedeem?: string
  dayOfWeek?: number // 0 = Sunday ... 6 = Saturday. Omit for a deal that runs every day.
  stat?: { value: string; unit: string } // headline figure for the deal-spotlight tile, e.g. { value: '10%', unit: 'OFF' }
}

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export const SPECIALS: Special[] = [
  {
    id: 'takapuna-cousin-scotts-wings',
    venueSlug: 'auckland-takapuna',
    partnerName: "Cousin Scott's",
    address: '4/486 Lake Road, Takapuna',
    website: 'https://www.cousinscotts.co.nz',
    title: '10% off wings',
    blurb: 'Just up the road from the courts.',
    stat: { value: '10%', unit: 'OFF' },
  },
]

export function getSpecialsForVenue(venueSlug: string): Special[] {
  return SPECIALS.filter(s => s.venueSlug === venueSlug)
}

export function isSpecialActiveOnDate(special: Special, dateStr: string): boolean {
  if (special.dayOfWeek === undefined) return true
  const d = new Date(dateStr + 'T00:00:00')
  return d.getDay() === special.dayOfWeek
}

export function getActiveSpecialsForVenueDate(venueSlug: string, dateStr: string): Special[] {
  return getSpecialsForVenue(venueSlug).filter(s => isSpecialActiveOnDate(s, dateStr))
}

// Cadence badge for a special: "Always on" for every-day deals, or the
// matching weekday — flagged live when today actually is that day.
export function cadencePill(s: Special): { text: string; live: boolean } {
  if (s.dayOfWeek === undefined) return { text: 'Always on', live: true }
  const isToday = new Date().getDay() === s.dayOfWeek
  return { text: isToday ? `${DAY_NAMES[s.dayOfWeek]} · today` : `${DAY_NAMES[s.dayOfWeek]}s only`, live: isToday }
}
