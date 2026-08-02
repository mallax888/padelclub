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
    blurb: "Any day you've played — just up the road from the courts",
    howToRedeem: "Mention you've played at Pacific Padel Takapuna",
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
