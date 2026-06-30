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
  // ── NEW ZEALAND ─────────────────────────────────────────
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
      { label: 'Free parking', icon: 'ti-parking' },
      { label: 'Pro shop', icon: 'ti-shopping-bag' },
      { label: 'Changing rooms', icon: 'ti-shirt' },
      { label: 'Floodlit courts', icon: 'ti-bulb' },
      { label: 'Social events', icon: 'ti-calendar' },
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
      { label: 'Free parking', icon: 'ti-parking' },
      { label: 'Changing rooms', icon: 'ti-shirt' },
      { label: 'Floodlit courts', icon: 'ti-bulb' },
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
      { label: 'Pro coaching', icon: 'ti-shirt' },
      { label: 'Social leagues', icon: 'ti-calendar' },
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
      { label: '24/7 access', icon: 'ti-bulb' },
      { label: 'Free parking', icon: 'ti-parking' },
      { label: 'Equipment rental', icon: 'ti-tools' },
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
      { label: 'Clubhouse cafe', icon: 'ti-coffee' },
      { label: 'Changing rooms', icon: 'ti-shirt' },
      { label: 'Equipment hire', icon: 'ti-tools' },
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
      { label: 'Free parking', icon: 'ti-parking' },
      { label: 'Pro shop', icon: 'ti-shopping-bag' },
      { label: 'Showers', icon: 'ti-shirt' },
    ],
  },

  // ── SOUTH AFRICA — NELSPRUIT ────────────────────────────
  {
    slug: 'nelspruit-play360',
    name: 'Play 360 Nelspruit',
    region: 'Nelspruit',
    address: '1692 Hermansburg Rd, Stonehenge, Mbombela 1211',
    isLive: true,
    courts: [
      { id: 'p360-1', name: 'Court 1', type: 'Glass-backed', isIndoor: false, x: 0, y: 0 },
      { id: 'p360-2', name: 'Court 2', type: 'Glass-backed', isIndoor: false, x: 1, y: 0 },
    ],
    amenities: [
      { label: 'Riverside setting', icon: 'ti-bulb' },
      { label: 'Friend Cafe nearby', icon: 'ti-coffee' },
      { label: 'Free parking', icon: 'ti-parking' },
    ],
  },
  {
    slug: 'nelspruit-padel24',
    name: 'Padel 24 Nelspruit',
    region: 'Nelspruit',
    address: 'LVCC, 1 Aurora Drive, Mbombela',
    isLive: true,
    courts: [
      { id: 'p24-1', name: 'Court 1', type: 'Glass-backed', isIndoor: false, x: 0, y: 0 },
      { id: 'p24-2', name: 'Court 2', type: 'Glass-backed', isIndoor: false, x: 1, y: 0 },
      { id: 'p24-3', name: 'Court 3', type: 'Glass-backed', isIndoor: false, x: 2, y: 0 },
    ],
    amenities: [
      { label: 'Pro shop', icon: 'ti-shopping-bag' },
      { label: 'Changing rooms', icon: 'ti-shirt' },
      { label: 'Free parking', icon: 'ti-parking' },
    ],
  },

  // ── SOUTH AFRICA — JOHANNESBURG ─────────────────────────
  {
    slug: 'jhb-africa-sandton',
    name: 'Africa Padel Sandton',
    region: 'Johannesburg',
    address: '181 Empire Place, Wierda Rd W, Sandhurst, Sandton',
    isLive: false,
    courts: [
      { id: 'aps-1', name: 'Court 1', type: 'Glass-backed', isIndoor: false, x: 0, y: 0 },
      { id: 'aps-2', name: 'Court 2', type: 'Glass-backed', isIndoor: false, x: 1, y: 0 },
      { id: 'aps-3', name: 'Court 3', type: 'Glass-backed', isIndoor: false, x: 2, y: 0 },
      { id: 'aps-4', name: 'Court 4', type: 'Glass-backed', isIndoor: false, x: 0, y: 1 },
      { id: 'aps-5', name: 'Court 5', type: 'Glass-backed', isIndoor: false, x: 1, y: 1 },
      { id: 'aps-6', name: 'Court 6', type: 'Glass-backed', isIndoor: false, x: 2, y: 1 },
    ],
    amenities: [
      { label: 'Largest venue in Africa', icon: 'ti-bulb' },
      { label: 'Naked Coffee on site', icon: 'ti-coffee' },
      { label: 'No membership required', icon: 'ti-calendar' },
      { label: 'Pro coaching', icon: 'ti-shopping-bag' },
    ],
  },
  {
    slug: 'jhb-rb-club',
    name: 'RB Club Johannesburg',
    region: 'Johannesburg',
    address: '5 Sunnyside Road, Birnam, Melrose Arch, Johannesburg',
    isLive: false,
    courts: [
      { id: 'rb-1', name: 'Court 1', type: 'Outdoor', isIndoor: false, x: 0, y: 0 },
      { id: 'rb-2', name: 'Court 2', type: 'Outdoor', isIndoor: false, x: 1, y: 0 },
      { id: 'rb-3', name: 'Court 3', type: 'Outdoor', isIndoor: false, x: 2, y: 0 },
      { id: 'rb-4', name: 'Court 4', type: 'Outdoor', isIndoor: false, x: 0, y: 1 },
      { id: 'rb-5', name: 'Court 5', type: 'Outdoor', isIndoor: false, x: 1, y: 1 },
      { id: 'rb-6', name: 'Court 6', type: 'Outdoor', isIndoor: false, x: 2, y: 1 },
      { id: 'rb-7', name: 'Court 7', type: 'Outdoor', isIndoor: false, x: 0, y: 2 },
      { id: 'rb-8', name: 'Court 8', type: 'Outdoor', isIndoor: false, x: 1, y: 2 },
    ],
    amenities: [
      { label: 'Restaurant on site', icon: 'ti-coffee' },
      { label: 'Pro shop', icon: 'ti-shopping-bag' },
      { label: 'Outdoor gym', icon: 'ti-bulb' },
      { label: 'Free parking', icon: 'ti-parking' },
      { label: 'Open 6am–10pm', icon: 'ti-calendar' },
    ],
  },
  {
    slug: 'jhb-clubpadel-pirates',
    name: 'ClubPadel Pirates',
    region: 'Johannesburg',
    address: '4 Cruden Bay Road, Greenside, Johannesburg',
    isLive: false,
    courts: [
      { id: 'cp-1', name: 'Court 1', type: 'Glass-backed', isIndoor: false, x: 0, y: 0 },
      { id: 'cp-2', name: 'Court 2', type: 'Glass-backed', isIndoor: false, x: 1, y: 0 },
      { id: 'cp-3', name: 'Court 3', type: 'Glass-backed', isIndoor: false, x: 2, y: 0 },
      { id: 'cp-4', name: 'Court 4', type: 'Glass-backed', isIndoor: false, x: 0, y: 1 },
      { id: 'cp-5', name: 'Court 5', type: 'Glass-backed', isIndoor: false, x: 1, y: 1 },
    ],
    amenities: [
      { label: 'Historic sports club (1888)', icon: 'ti-bulb' },
      { label: 'Social leagues', icon: 'ti-calendar' },
      { label: 'Coaching available', icon: 'ti-shopping-bag' },
    ],
  },
  {
    slug: 'jhb-africa-dunkeld',
    name: 'Africa Padel Dunkeld',
    region: 'Johannesburg',
    address: 'Dunkeld, Johannesburg',
    isLive: false,
    courts: [
      { id: 'apd-1', name: 'Court 1', type: 'Glass-backed', isIndoor: false, x: 0, y: 0 },
      { id: 'apd-2', name: 'Court 2', type: 'Glass-backed', isIndoor: false, x: 1, y: 0 },
      { id: 'apd-3', name: 'Court 3', type: 'Glass-backed', isIndoor: false, x: 2, y: 0 },
      { id: 'apd-4', name: 'Court 4', type: 'Glass-backed', isIndoor: false, x: 0, y: 1 },
      { id: 'apd-5', name: 'Court 5', type: 'Glass-backed', isIndoor: false, x: 1, y: 1 },
    ],
    amenities: [
      { label: 'Restaurant on site', icon: 'ti-coffee' },
      { label: 'Sports viewing screen', icon: 'ti-bulb' },
      { label: 'Family friendly', icon: 'ti-calendar' },
    ],
  },

  // ── SOUTH AFRICA — CAPE TOWN ─────────────────────────────
  {
    slug: 'cpt-africa-campsbay',
    name: 'Africa Padel Camps Bay',
    region: 'Cape Town',
    address: 'The Rotunda, AF Keen Drive, Camps Bay, Cape Town',
    isLive: false,
    courts: [
      { id: 'apcb-1', name: 'Court 1', type: 'Indoor (Victorian dome)', isIndoor: true, x: 0, y: 0 },
      { id: 'apcb-2', name: 'Court 2', type: 'Outdoor (ocean view)', isIndoor: false, x: 1, y: 0 },
      { id: 'apcb-3', name: 'Court 3', type: 'Outdoor (ocean view)', isIndoor: false, x: 2, y: 0 },
      { id: 'apcb-4', name: 'Court 4', type: 'Outdoor (ocean view)', isIndoor: false, x: 0, y: 1 },
      { id: 'apcb-5', name: 'Court 5', type: 'Outdoor (ocean view)', isIndoor: false, x: 1, y: 1 },
    ],
    amenities: [
      { label: 'Ocean & mountain views', icon: 'ti-bulb' },
      { label: 'Restaurant on site', icon: 'ti-coffee' },
      { label: 'Kids playground', icon: 'ti-calendar' },
      { label: 'Indoor + outdoor courts', icon: 'ti-shirt' },
    ],
  },
  {
    slug: 'cpt-africa-claremont',
    name: 'Africa Padel Claremont',
    region: 'Cape Town',
    address: 'Herschel Close, Claremont, Cape Town',
    isLive: false,
    courts: [
      { id: 'apcl-1', name: 'Court 1', type: 'Glass-backed', isIndoor: false, x: 0, y: 0 },
      { id: 'apcl-2', name: 'Court 2', type: 'Glass-backed', isIndoor: false, x: 1, y: 0 },
      { id: 'apcl-3', name: 'Court 3', type: 'Glass-backed', isIndoor: false, x: 2, y: 0 },
      { id: 'apcl-4', name: 'Court 4', type: 'Glass-backed', isIndoor: false, x: 0, y: 1 },
      { id: 'apcl-5', name: 'Court 5', type: 'Glass-backed', isIndoor: false, x: 1, y: 1 },
      { id: 'apcl-6', name: 'Court 6', type: 'Glass-backed', isIndoor: false, x: 2, y: 1 },
      { id: 'apcl-7', name: 'Court 7', type: 'Glass-backed', isIndoor: false, x: 0, y: 2 },
      { id: 'apcl-8', name: 'Court 8', type: 'Glass-backed', isIndoor: false, x: 1, y: 2 },
      { id: 'apcl-9', name: 'Court 9', type: 'Glass-backed', isIndoor: false, x: 2, y: 2 },
    ],
    amenities: [
      { label: 'Mountain views', icon: 'ti-bulb' },
      { label: 'Private lessons', icon: 'ti-shopping-bag' },
      { label: 'Near Cavendish Square', icon: 'ti-parking' },
    ],
  },
  {
    slug: 'cpt-atlantic-padel',
    name: 'Atlantic Padel',
    region: 'Cape Town',
    address: '1 Donkin Avenue, Table View, Cape Town',
    isLive: false,
    courts: [
      { id: 'ap-1', name: 'Court 1', type: 'Crystal (panoramic)', isIndoor: false, x: 0, y: 0 },
      { id: 'ap-2', name: 'Court 2', type: 'Crystal (panoramic)', isIndoor: false, x: 1, y: 0 },
      { id: 'ap-3', name: 'Court 3', type: 'Crystal (panoramic)', isIndoor: false, x: 2, y: 0 },
      { id: 'ap-4', name: 'Court 4', type: 'Crystal (panoramic)', isIndoor: false, x: 0, y: 1 },
    ],
    amenities: [
      { label: 'Table Mountain views', icon: 'ti-bulb' },
      { label: 'Coffee shop + pizza', icon: 'ti-coffee' },
      { label: 'Tournaments + leagues', icon: 'ti-calendar' },
      { label: 'Spanish crystal courts', icon: 'ti-shopping-bag' },
    ],
  },
  {
    slug: 'cpt-rb-club',
    name: 'RB Club Cape Town',
    region: 'Cape Town',
    address: 'Cape Town',
    isLive: false,
    courts: [
      { id: 'rbct-1', name: 'Court 1', type: 'Indoor', isIndoor: true, x: 0, y: 0 },
      { id: 'rbct-2', name: 'Court 2', type: 'Indoor', isIndoor: true, x: 1, y: 0 },
      { id: 'rbct-3', name: 'Court 3', type: 'Indoor', isIndoor: true, x: 2, y: 0 },
      { id: 'rbct-4', name: 'Court 4', type: 'Indoor', isIndoor: true, x: 0, y: 1 },
    ],
    amenities: [
      { label: 'Indoor courts', icon: 'ti-bulb' },
      { label: 'Restaurant on site', icon: 'ti-coffee' },
      { label: 'Open 6am–10pm', icon: 'ti-calendar' },
    ],
  },

  // ── SOUTH AFRICA — DURBAN ────────────────────────────────
  {
    slug: 'dbn-africa-ballito',
    name: 'Africa Padel Ballito',
    region: 'Durban',
    address: 'Ballito, KwaZulu-Natal',
    isLive: false,
    courts: [
      { id: 'apb-1', name: 'Court 1', type: 'Glass-backed', isIndoor: false, x: 0, y: 0 },
      { id: 'apb-2', name: 'Court 2', type: 'Glass-backed', isIndoor: false, x: 1, y: 0 },
      { id: 'apb-3', name: 'Court 3', type: 'Glass-backed', isIndoor: false, x: 2, y: 0 },
    ],
    amenities: [
      { label: 'Cafe on site', icon: 'ti-coffee' },
      { label: 'Coaching available', icon: 'ti-shopping-bag' },
      { label: 'Social leagues', icon: 'ti-calendar' },
    ],
  },
  {
    slug: 'dbn-padel-nation',
    name: 'Padel Nation Umhlanga',
    region: 'Durban',
    address: 'Umhlanga, Durban, KwaZulu-Natal',
    isLive: false,
    courts: [
      { id: 'pn-1', name: 'Court 1', type: 'Glass-backed', isIndoor: false, x: 0, y: 0 },
      { id: 'pn-2', name: 'Court 2', type: 'Glass-backed', isIndoor: false, x: 1, y: 0 },
      { id: 'pn-3', name: 'Court 3', type: 'Glass-backed', isIndoor: false, x: 2, y: 0 },
    ],
    amenities: [
      { label: 'Beachside location', icon: 'ti-bulb' },
      { label: 'Pro coaching', icon: 'ti-shopping-bag' },
      { label: 'Free parking', icon: 'ti-parking' },
    ],
  },
  {
    slug: 'dbn-gayle-hillcrest',
    name: 'Gayle Padel Hillcrest',
    region: 'Durban',
    address: 'Hillcrest, Durban, KwaZulu-Natal',
    isLive: false,
    courts: [
      { id: 'gph-1', name: 'Court 1', type: 'Glass-backed', isIndoor: false, x: 0, y: 0 },
      { id: 'gph-2', name: 'Court 2', type: 'Glass-backed', isIndoor: false, x: 1, y: 0 },
      { id: 'gph-3', name: 'Court 3', type: 'Glass-backed', isIndoor: false, x: 2, y: 0 },
      { id: 'gph-4', name: 'Court 4', type: 'Glass-backed', isIndoor: false, x: 0, y: 1 },
    ],
    amenities: [
      { label: 'Coaching available', icon: 'ti-shopping-bag' },
      { label: 'Social leagues', icon: 'ti-calendar' },
      { label: 'Free parking', icon: 'ti-parking' },
    ],
  },

  // ── SOUTH AFRICA — PRETORIA ──────────────────────────────
  {
    slug: 'pta-africa-olympus',
    name: 'Africa Padel Olympus',
    region: 'Pretoria',
    address: 'Olympus, Pretoria, Gauteng',
    isLive: false,
    courts: [
      { id: 'apo-1', name: 'Court 1', type: 'Glass-backed', isIndoor: false, x: 0, y: 0 },
      { id: 'apo-2', name: 'Court 2', type: 'Glass-backed', isIndoor: false, x: 1, y: 0 },
      { id: 'apo-3', name: 'Court 3', type: 'Glass-backed', isIndoor: false, x: 2, y: 0 },
      { id: 'apo-4', name: 'Court 4', type: 'Glass-backed', isIndoor: false, x: 0, y: 1 },
      { id: 'apo-5', name: 'Court 5', type: 'Covered (Campotek roof)', isIndoor: true, x: 1, y: 1 },
    ],
    amenities: [
      { label: 'Pro shop', icon: 'ti-shopping-bag' },
      { label: 'Restaurant on site', icon: 'ti-coffee' },
      { label: 'Next to Planet Fitness', icon: 'ti-bulb' },
      { label: 'Covered court', icon: 'ti-shirt' },
    ],
  },
  {
    slug: 'pta-africa-brooklyn',
    name: 'Africa Padel Brooklyn',
    region: 'Pretoria',
    address: 'Brooklyn, Pretoria, Gauteng',
    isLive: false,
    courts: [
      { id: 'apbk-1', name: 'Court 1', type: 'Glass-backed', isIndoor: false, x: 0, y: 0 },
      { id: 'apbk-2', name: 'Court 2', type: 'Glass-backed', isIndoor: false, x: 1, y: 0 },
      { id: 'apbk-3', name: 'Court 3', type: 'Glass-backed', isIndoor: false, x: 2, y: 0 },
      { id: 'apbk-4', name: 'Court 4', type: 'Glass-backed', isIndoor: false, x: 0, y: 1 },
      { id: 'apbk-5', name: 'Court 5', type: 'Glass-backed', isIndoor: false, x: 1, y: 1 },
      { id: 'apbk-6', name: 'Court 6', type: 'Glass-backed', isIndoor: false, x: 2, y: 1 },
    ],
    amenities: [
      { label: 'Brand new courts', icon: 'ti-bulb' },
      { label: 'Coaching available', icon: 'ti-shopping-bag' },
      { label: 'Social leagues', icon: 'ti-calendar' },
    ],
  },
  {
    slug: 'pta-balwin-waterfall',
    name: 'Balwin Padel Waterfall City',
    region: 'Pretoria',
    address: 'Munyaka Drive, Munyaka Waterfall City, Johannesburg 3610',
    isLive: false,
    courts: [
      { id: 'bpw-1', name: 'Court 1', type: 'Indoor', isIndoor: true, x: 0, y: 0 },
      { id: 'bpw-2', name: 'Court 2', type: 'Indoor', isIndoor: true, x: 1, y: 0 },
      { id: 'bpw-3', name: 'Court 3', type: 'Indoor', isIndoor: true, x: 2, y: 0 },
      { id: 'bpw-4', name: 'Court 4', type: 'Indoor', isIndoor: true, x: 0, y: 1 },
      { id: 'bpw-5', name: 'Court 5', type: 'Indoor', isIndoor: true, x: 1, y: 1 },
    ],
    amenities: [
      { label: 'FIP tournament venue', icon: 'ti-bulb' },
      { label: '10 total courts', icon: 'ti-calendar' },
      { label: 'Indoor facility', icon: 'ti-shirt' },
    ],
  },
]

export function getVenue(slug: string): Venue {
  return VENUES.find(v => v.slug === slug) ?? VENUES[0]
}


