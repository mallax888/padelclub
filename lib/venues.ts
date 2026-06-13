export type VenueCourt = {
  id: string
  name: string
  type: string
  isIndoor: boolean
  x: number
  y: number
}

export type VenueAmenity = {
  label: string
  icon: string
}

export type Venue = {
  slug: string
  name: string
  region: string
  address: string
  isLive: boolean
  courts: VenueCourt[]
  amenities: VenueAmenity[]
}

export const VENUES: Venue[] = [
  {
    slug: 'auckland',
    name: 'PadelClub Auckland',
    region: 'Auckland',
    address: 'Quay Park, Auckland CBD',
    isLive: true,
    courts: [
      { id: 'court-1', name: 'Court 1', type: 'Glass-backed', isIndoor: true,  x: 0, y: 0 },
      { id: 'court-2', name: 'Court 2', type: 'Glass-backed', isIndoor: true,  x: 1, y: 0 },
      { id: 'court-3', name: 'Court 3', type: 'Open-sided',   isIndoor: false, x: 0, y: 1 },
      { id: 'court-4', name: 'Court 4', type: 'Open-sided',   isIndoor: false, x: 1, y: 1 },
    ],
    amenities: [
      { label: 'Free parking',     icon: 'ti-parking' },
      { label: 'Clubhouse cafe',   icon: 'ti-coffee' },
      { label: 'Changing rooms',   icon: 'ti-shirt' },
      { label: 'Pro shop',         icon: 'ti-shopping-bag' },
      { label: 'Floodlit courts',  icon: 'ti-bulb' },
    ],
  },
  {
    slug: 'wellington',
    name: 'PadelClub Wellington',
    region: 'Wellington',
    address: 'Te Aro, Wellington',
    isLive: false,
    courts: [
      { id: 'wlg-1', name: 'Court 1', type: 'Glass-backed', isIndoor: true, x: 0, y: 0 },
      { id: 'wlg-2', name: 'Court 2', type: 'Glass-backed', isIndoor: true, x: 1, y: 0 },
      { id: 'wlg-3', name: 'Court 3', type: 'Glass-backed', isIndoor: true, x: 2, y: 0 },
    ],
    amenities: [
      { label: 'Underground parking', icon: 'ti-parking' },
      { label: 'Clubhouse cafe',      icon: 'ti-coffee' },
      { label: 'Changing rooms',      icon: 'ti-shirt' },
      { label: 'Equipment hire',      icon: 'ti-tools' },
    ],
  },
  {
    slug: 'christchurch',
    name: 'PadelClub Christchurch',
    region: 'Christchurch',
    address: 'Riccarton, Christchurch',
    isLive: false,
    courts: [
      { id: 'chc-1', name: 'Court 1', type: 'Open-sided', isIndoor: false, x: 0, y: 0 },
      { id: 'chc-2', name: 'Court 2', type: 'Open-sided', isIndoor: false, x: 1, y: 0 },
      { id: 'chc-3', name: 'Court 3', type: 'Open-sided', isIndoor: false, x: 0, y: 1 },
      { id: 'chc-4', name: 'Court 4', type: 'Open-sided', isIndoor: false, x: 1, y: 1 },
      { id: 'chc-5', name: 'Court 5', type: 'Glass-backed', isIndoor: true, x: 2, y: 0 },
      { id: 'chc-6', name: 'Court 6', type: 'Glass-backed', isIndoor: true, x: 2, y: 1 },
    ],
    amenities: [
      { label: 'Free parking',    icon: 'ti-parking' },
      { label: 'Clubhouse cafe',  icon: 'ti-coffee' },
      { label: 'Changing rooms',  icon: 'ti-shirt' },
      { label: 'Floodlit courts', icon: 'ti-bulb' },
      { label: 'Kids play area',  icon: 'ti-baby-carriage' },
    ],
  },
]

export function getVenue(slug: string): Venue {
  return VENUES.find(v => v.slug === slug) ?? VENUES[0]
}
