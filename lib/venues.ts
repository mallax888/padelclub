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
    slug: 'auckland-albany',
    name: 'Pacific Padel Albany',
    region: 'Auckland',
    address: 'Albany Tennis Park, 325 Oteha Valley Road, Albany',
    isLive: true,
    courts: [
      { id: 'alb-1', name: 'Court 1', type: 'Glass-backed', isIndoor: false, x: 0, y: 0 },
      { id: 'alb-2', name: 'Court 2', type: 'Glass-backed', isIndoor: false, x: 1, y: 0 },
      { id: 'alb-3', name: 'Court 3', type: 'Glass-backed', isIndoor: false, x: 0, y: 1 },
      { id: 'alb-4', name: 'Court 4', type: 'Glass-backed', isIndoor: false, x: 1, y: 1 },
    ],
    amenities: [
      { label: 'Free parking',    icon: 'ti-parking' },
      { label: 'Pro shop',        icon: 'ti-shopping-bag' },
      { label: 'Changing rooms',  icon: 'ti-shirt' },
      { label: 'Floodlit courts', icon: 'ti-bulb' },
      { label: 'Social events',   icon: 'ti-calendar' },
    ],
  },
  {
    slug: 'auckland-merton',
    name: 'Pacific Padel Merton Road',
    region: 'Auckland',
    address: '69 Merton Road, St Johns, Auckland',
    isLive: false,
    courts: [
      { id: 'mrt-1', name: 'Court 1', type: 'Glass-backed', isIndoor: false, x: 0, y: 0 },
      { id: 'mrt-2', name: 'Court 2', type: 'Glass-backed', isIndoor: false, x: 1, y: 0 },
      { id: 'mrt-3', name: 'Court 3', type: 'Glass-backed', isIndoor: false, x: 2, y: 0 },
      { id: 'mrt-4', name: 'Court 4', type: 'Glass-backed', isIndoor: false, x: 0, y: 1 },
    ],
    amenities: [
      { label: 'Free parking',    icon: 'ti-parking' },
      { label: 'Changing rooms',  icon: 'ti-shirt' },
      { label: 'Floodlit courts', icon: 'ti-bulb' },
      { label: 'Social events',   icon: 'ti-calendar' },
    ],
  },
  {
    slug: 'auckland-takapuna',
    name: 'Pacific Padel Takapuna',
    region: 'Auckland',
    address: '40 Anzac Street, Takapuna, Auckland 0622',
    isLive: false,
    courts: [
      { id: 'tak-1', name: 'Court 1', type: 'Glass-backed', isIndoor: false, x: 0, y: 0 },
      { id: 'tak-2', name: 'Court 2', type: 'Glass-backed', isIndoor: false, x: 1, y: 0 },
      { id: 'tak-3', name: 'Court 3', type: 'Glass-backed', isIndoor: false, x: 2, y: 0 },
    ],
    amenities: [
      { label: 'Beachfront location', icon: 'ti-bulb' },
      { label: 'Pro coaching',        icon: 'ti-shirt' },
      { label: 'Social leagues',      icon: 'ti-calendar' },
    ],
  },
  {
    slug: 'auckland-brownsbay',
    name: 'Indoor Padel Browns Bay',
    region: 'Auckland',
    address: '50 Anzac Road, Browns Bay, Auckland 0630',
    isLive: false,
    courts: [
      { id: 'bb-1', name: 'Court 1', type: 'Indoor (24/7)', isIndoor: true, x: 0, y: 0 },
    ],
    amenities: [
      { label: '24/7 access',       icon: 'ti-bulb' },
      { label: 'Free parking (x5)', icon: 'ti-parking' },
      { label: 'Equipment rental',  icon: 'ti-tools' },
      { label: 'Vending machine',   icon: 'ti-shopping-bag' },
      { label: 'Changing rooms',    icon: 'ti-shirt' },
    ],
  },
  {
    slug: 'wellington',
    name: 'Padel House NZ',
    region: 'Wellington',
    address: '48a Kemp Street, Kilbirnie, Wellington',
    isLive: false,
    courts: [
      { id: 'wlg-1', name: 'Court 1', type: 'Glass-backed (Doubles)', isIndoor: true, x: 0, y: 0 },
      { id: 'wlg-2', name: 'Court 2', type: 'Glass-backed (Doubles)', isIndoor: true, x: 1, y: 0 },
      { id: 'wlg-3', name: 'Court 3', type: 'Glass-backed (Doubles)', isIndoor: true, x: 2, y: 0 },
      { id: 'wlg-4', name: 'Court 4', type: 'Glass-backed (Singles)', isIndoor: true, x: 0, y: 1 },
    ],
    amenities: [
      { label: 'Indoor — all weather', icon: 'ti-bulb' },
      { label: 'Clubhouse cafe',       icon: 'ti-coffee' },
      { label: 'Changing rooms',       icon: 'ti-shirt' },
      { label: 'Equipment hire',       icon: 'ti-tools' },
    ],
  },
  {
    slug: 'christchurch',
    name: 'Pacific Padel Wilding Park',
    region: 'Christchurch',
    address: '111 Woodham Road, Linwood, Christchurch 8062',
    isLive: false,
    courts: [
      { id: 'chc-1', name: 'Court 1', type: 'Glass-backed', isIndoor: false, x: 0, y: 0 },
      { id: 'chc-2', name: 'Court 2', type: 'Glass-backed', isIndoor: false, x: 1, y: 0 },
      { id: 'chc-3', name: 'Court 3', type: 'Glass-backed', isIndoor: false, x: 0, y: 1 },
      { id: 'chc-4', name: 'Court 4', type: 'Glass-backed', isIndoor: false, x: 1, y: 1 },
    ],
    amenities: [
      { label: 'Free on-site parking', icon: 'ti-parking' },
      { label: 'Pro shop',             icon: 'ti-shopping-bag' },
      { label: 'Showers',              icon: 'ti-shirt' },
      { label: 'Social events',        icon: 'ti-calendar' },
    ],
  },
]

export function getVenue(slug: string): Venue {
  return VENUES.find(v => v.slug === slug) ?? VENUES[0]
}
