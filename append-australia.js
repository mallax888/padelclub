const fs = require('fs');
let c = fs.readFileSync('lib/venues.ts', 'utf8');

const australia = `
  // ── AUSTRALIA — SYDNEY ──────────────────────────────────
  {
    slug: 'syd-racquet-club',
    name: 'Sydney Racquet Club',
    region: 'Sydney',
    address: '17 Park Road North, Moore Park, Sydney NSW 2021',
    isLive: false,
    courts: [
      { id: 'src-1', name: 'Court 1', type: 'Glass-backed', isIndoor: false, x: 0, y: 0 },
      { id: 'src-2', name: 'Court 2', type: 'Glass-backed', isIndoor: false, x: 1, y: 0 },
      { id: 'src-3', name: 'Court 3', type: 'Glass-backed', isIndoor: false, x: 2, y: 0 },
    ],
    amenities: [
      { label: 'Bar on site', icon: 'ti-coffee' },
      { label: 'Pro shop', icon: 'ti-shopping-bag' },
      { label: 'Floodlit courts', icon: 'ti-bulb' },
      { label: 'Entertainment Quarter', icon: 'ti-star' },
    ],
  },
  {
    slug: 'syd-tribe-padel',
    name: 'Tribe Padel & Wellness',
    region: 'Sydney',
    address: '16/18 Epping Road, North Ryde, Sydney NSW 2113',
    isLive: false,
    courts: [
      { id: 'tpw-1', name: 'Court 1', type: 'Glass-backed', isIndoor: false, x: 0, y: 0 },
      { id: 'tpw-2', name: 'Court 2', type: 'Glass-backed', isIndoor: false, x: 1, y: 0 },
      { id: 'tpw-3', name: 'Court 3', type: 'Glass-backed', isIndoor: false, x: 2, y: 0 },
      { id: 'tpw-4', name: 'Court 4', type: 'Glass-backed', isIndoor: false, x: 0, y: 1 },
    ],
    amenities: [
      { label: 'Free parking', icon: 'ti-parking' },
      { label: 'Wellness hub', icon: 'ti-bulb' },
      { label: 'Ice baths & sauna', icon: 'ti-shirt' },
      { label: 'Equipment rental', icon: 'ti-tools' },
    ],
  },
  {
    slug: 'syd-indoor-padel-alexandria',
    name: 'Indoor Padel Australia Alexandria',
    region: 'Sydney',
    address: '85 O\'Riordan Street, Alexandria, Sydney NSW 2015',
    isLive: false,
    courts: [
      { id: 'ipa-1', name: 'Court 1', type: 'Indoor', isIndoor: true, x: 0, y: 0 },
      { id: 'ipa-2', name: 'Court 2', type: 'Indoor', isIndoor: true, x: 1, y: 0 },
      { id: 'ipa-3', name: 'Court 3', type: 'Indoor', isIndoor: true, x: 2, y: 0 },
      { id: 'ipa-4', name: 'Court 4', type: 'Indoor', isIndoor: true, x: 0, y: 1 },
      { id: 'ipa-5', name: 'Court 5', type: 'Indoor', isIndoor: true, x: 1, y: 1 },
      { id: 'ipa-6', name: 'Court 6', type: 'Indoor', isIndoor: true, x: 2, y: 1 },
      { id: 'ipa-7', name: 'Court 7', type: 'Indoor', isIndoor: true, x: 0, y: 2 },
      { id: 'ipa-8', name: 'Court 8', type: 'Indoor', isIndoor: true, x: 1, y: 2 },
      { id: 'ipa-9', name: 'Court 9', type: 'Outdoor', isIndoor: false, x: 2, y: 2 },
      { id: 'ipa-10', name: 'Court 10', type: 'Outdoor', isIndoor: false, x: 0, y: 3 },
    ],
    amenities: [
      { label: '8 indoor + 2 outdoor', icon: 'ti-shirt' },
      { label: 'Changing rooms', icon: 'ti-shirt' },
      { label: 'Pro shop', icon: 'ti-shopping-bag' },
    ],
  },
  // ── AUSTRALIA — MELBOURNE ────────────────────────────────
  {
    slug: 'mel-recess-padel',
    name: 'Recess Padel Club',
    region: 'Melbourne',
    address: '17 Rocklea Drive, Port Melbourne, VIC 3207',
    isLive: false,
    courts: [
      { id: 'rpc-1', name: 'Court 1', type: 'Indoor', isIndoor: true, x: 0, y: 0 },
      { id: 'rpc-2', name: 'Court 2', type: 'Indoor', isIndoor: true, x: 1, y: 0 },
      { id: 'rpc-3', name: 'Court 3', type: 'Indoor', isIndoor: true, x: 2, y: 0 },
      { id: 'rpc-4', name: 'Court 4', type: 'Indoor', isIndoor: true, x: 0, y: 1 },
      { id: 'rpc-5', name: 'Court 5', type: 'Indoor', isIndoor: true, x: 1, y: 1 },
      { id: 'rpc-6', name: 'Court 6', type: 'Indoor', isIndoor: true, x: 2, y: 1 },
      { id: 'rpc-7', name: 'Court 7', type: 'Indoor', isIndoor: true, x: 0, y: 2 },
    ],
    amenities: [
      { label: '7 indoor courts', icon: 'ti-shirt' },
      { label: 'Pro shop', icon: 'ti-shopping-bag' },
      { label: 'Changing rooms', icon: 'ti-shirt' },
    ],
  },
  {
    slug: 'mel-g4p-docklands',
    name: 'G4P Docklands',
    region: 'Melbourne',
    address: '194-206 Lorimer Street, Docklands, VIC 3008',
    isLive: false,
    courts: [
      { id: 'g4d-1', name: 'Court 1', type: 'Covered outdoor', isIndoor: false, x: 0, y: 0 },
      { id: 'g4d-2', name: 'Court 2', type: 'Covered outdoor', isIndoor: false, x: 1, y: 0 },
      { id: 'g4d-3', name: 'Court 3', type: 'Covered outdoor', isIndoor: false, x: 2, y: 0 },
      { id: 'g4d-4', name: 'Court 4', type: 'Covered outdoor', isIndoor: false, x: 0, y: 1 },
      { id: 'g4d-5', name: 'Court 5', type: 'Covered outdoor', isIndoor: false, x: 1, y: 1 },
      { id: 'g4d-6', name: 'Court 6', type: 'Covered outdoor', isIndoor: false, x: 2, y: 1 },
      { id: 'g4d-7', name: 'Court 7', type: 'Covered outdoor', isIndoor: false, x: 0, y: 2 },
    ],
    amenities: [
      { label: '7 covered courts', icon: 'ti-shirt' },
      { label: 'Pro shop', icon: 'ti-shopping-bag' },
      { label: 'City skyline views', icon: 'ti-bulb' },
      { label: 'Social leagues', icon: 'ti-calendar' },
    ],
  },
  {
    slug: 'mel-crown-racquet-club',
    name: 'Crown Racquet Club',
    region: 'Melbourne',
    address: '8 Whiteman Street, Southbank, VIC 3006',
    isLive: false,
    courts: [
      { id: 'crc-1', name: 'Court 1', type: 'Panoramic outdoor', isIndoor: false, x: 0, y: 0 },
      { id: 'crc-2', name: 'Court 2', type: 'Panoramic outdoor', isIndoor: false, x: 1, y: 0 },
    ],
    amenities: [
      { label: 'Grey Goose bar', icon: 'ti-coffee' },
      { label: 'Yarra riverfront', icon: 'ti-bulb' },
      { label: 'DJ booth', icon: 'ti-star' },
    ],
  },
  {
    slug: 'mel-ipadel',
    name: 'iPadel Melbourne',
    region: 'Melbourne',
    address: '38 Newlands Road, Reservoir, VIC 3073',
    isLive: false,
    courts: [
      { id: 'ipm-1', name: 'Court 1', type: 'Indoor', isIndoor: true, x: 0, y: 0 },
      { id: 'ipm-2', name: 'Court 2', type: 'Indoor', isIndoor: true, x: 1, y: 0 },
      { id: 'ipm-3', name: 'Court 3', type: 'Indoor', isIndoor: true, x: 2, y: 0 },
      { id: 'ipm-4', name: 'Court 4', type: 'Outdoor', isIndoor: false, x: 0, y: 1 },
    ],
    amenities: [
      { label: 'Indoor + outdoor', icon: 'ti-shirt' },
      { label: 'Equipment rental', icon: 'ti-tools' },
      { label: 'Free parking', icon: 'ti-parking' },
    ],
  },
  // ── AUSTRALIA — BRISBANE ─────────────────────────────────
  {
    slug: 'bri-padel-the-gap',
    name: 'Padel Brisbane The Gap',
    region: 'Brisbane',
    address: '200 Settlement Road, The Gap, QLD 4061',
    isLive: false,
    courts: [
      { id: 'pbg-1', name: 'Court 1', type: 'Glass-backed', isIndoor: false, x: 0, y: 0 },
      { id: 'pbg-2', name: 'Court 2', type: 'Glass-backed', isIndoor: false, x: 1, y: 0 },
      { id: 'pbg-3', name: 'Court 3', type: 'Glass-backed', isIndoor: false, x: 2, y: 0 },
      { id: 'pbg-4', name: 'Court 4', type: 'Glass-backed', isIndoor: false, x: 0, y: 1 },
    ],
    amenities: [
      { label: 'Free parking', icon: 'ti-parking' },
      { label: 'Floodlit courts', icon: 'ti-bulb' },
      { label: 'Social leagues', icon: 'ti-calendar' },
    ],
  },
  // ── AUSTRALIA — PERTH ────────────────────────────────────
  {
    slug: 'per-padel-perth-reabold',
    name: 'Padel Perth Reabold',
    region: 'Perth',
    address: 'Reabold, Perth WA',
    isLive: false,
    courts: [
      { id: 'ppr-1', name: 'Court 1', type: 'Glass-backed', isIndoor: false, x: 0, y: 0 },
      { id: 'ppr-2', name: 'Court 2', type: 'Glass-backed', isIndoor: false, x: 1, y: 0 },
      { id: 'ppr-3', name: 'Court 3', type: 'Glass-backed', isIndoor: false, x: 2, y: 0 },
    ],
    amenities: [
      { label: 'Free parking', icon: 'ti-parking' },
      { label: 'Floodlit courts', icon: 'ti-bulb' },
    ],
  },
  {
    slug: 'per-padelwest',
    name: 'Padelwest',
    region: 'Perth',
    address: 'Canning Highway & Stock Road, Perth WA',
    isLive: false,
    courts: [
      { id: 'pwt-1', name: 'Court 1', type: 'Glass-backed', isIndoor: false, x: 0, y: 0 },
      { id: 'pwt-2', name: 'Court 2', type: 'Glass-backed', isIndoor: false, x: 1, y: 0 },
    ],
    amenities: [
      { label: 'Free parking', icon: 'ti-parking' },
      { label: 'Social leagues', icon: 'ti-calendar' },
    ],
  },
  {
    slug: 'per-west-coast-padel',
    name: 'West Coast Padel',
    region: 'Perth',
    address: 'Perth WA',
    isLive: false,
    courts: [
      { id: 'wcp-1', name: 'Court 1', type: 'Glass-backed', isIndoor: false, x: 0, y: 0 },
      { id: 'wcp-2', name: 'Court 2', type: 'Glass-backed', isIndoor: false, x: 1, y: 0 },
      { id: 'wcp-3', name: 'Court 3', type: 'Glass-backed', isIndoor: false, x: 2, y: 0 },
    ],
    amenities: [
      { label: 'Coaching available', icon: 'ti-shopping-bag' },
      { label: 'Equipment rental', icon: 'ti-tools' },
    ],
  },
  {
    slug: 'per-padel-crush',
    name: 'Padel Crush',
    region: 'Perth',
    address: 'Perth WA',
    isLive: false,
    courts: [
      { id: 'pcu-1', name: 'Court 1', type: 'Glass-backed', isIndoor: false, x: 0, y: 0 },
      { id: 'pcu-2', name: 'Court 2', type: 'Glass-backed', isIndoor: false, x: 1, y: 0 },
      { id: 'pcu-3', name: 'Court 3', type: 'Glass-backed', isIndoor: false, x: 2, y: 0 },
      { id: 'pcu-4', name: 'Court 4', type: 'Glass-backed', isIndoor: false, x: 0, y: 1 },
    ],
    amenities: [
      { label: 'Pro shop', icon: 'ti-shopping-bag' },
      { label: 'Social leagues', icon: 'ti-calendar' },
    ],
  },
  {
    slug: 'per-padel360',
    name: 'Padel360',
    region: 'Perth',
    address: 'Perth WA',
    isLive: false,
    courts: [
      { id: 'p360-1', name: 'Court 1', type: 'Glass-backed', isIndoor: false, x: 0, y: 0 },
      { id: 'p360-2', name: 'Court 2', type: 'Glass-backed', isIndoor: false, x: 1, y: 0 },
      { id: 'p360-3', name: 'Court 3', type: 'Glass-backed', isIndoor: false, x: 2, y: 0 },
      { id: 'p360-4', name: 'Court 4', type: 'Glass-backed', isIndoor: false, x: 0, y: 1 },
    ],
    amenities: [
      { label: 'Coaching available', icon: 'ti-shopping-bag' },
      { label: 'Social leagues', icon: 'ti-calendar' },
    ],
  },
  {
    slug: 'per-padel-kennedy-bay',
    name: 'Padel Kennedy Bay',
    region: 'Perth',
    address: 'Kennedy Bay, Perth WA',
    isLive: false,
    courts: [
      { id: 'pkb-1', name: 'Court 1', type: 'Glass-backed', isIndoor: false, x: 0, y: 0 },
      { id: 'pkb-2', name: 'Court 2', type: 'Glass-backed', isIndoor: false, x: 1, y: 0 },
      { id: 'pkb-3', name: 'Court 3', type: 'Glass-backed', isIndoor: false, x: 2, y: 0 },
      { id: 'pkb-4', name: 'Court 4', type: 'Glass-backed', isIndoor: false, x: 0, y: 1 },
    ],
    amenities: [
      { label: 'Waterfront location', icon: 'ti-bulb' },
      { label: 'Free parking', icon: 'ti-parking' },
    ],
  },
`;

c = c.replace(
  ']\nexport function getVenue',
  australia + ']\nexport function getVenue'
);

fs.writeFileSync('lib/venues.ts', c, 'utf8');
console.log('Lines now:', c.split('\n').length);
