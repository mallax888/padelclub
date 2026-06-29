const fs = require('fs');
let c = fs.readFileSync('lib/venues.ts', 'utf8');

const australiaVenues = `
  // ── AUSTRALIA — SYDNEY ──────────────────────────────────
  {
    slug: 'syd-padel-moore-park',
    name: 'Padel Moore Park',
    region: 'Sydney',
    address: 'Lang Road, Moore Park, Sydney NSW 2021',
    isLive: false,
    courts: [
      { id: 'smp-1', name: 'Court 1', type: 'Glass-backed', isIndoor: false, x: 0, y: 0 },
      { id: 'smp-2', name: 'Court 2', type: 'Glass-backed', isIndoor: false, x: 1, y: 0 },
      { id: 'smp-3', name: 'Court 3', type: 'Glass-backed', isIndoor: false, x: 2, y: 0 },
      { id: 'smp-4', name: 'Court 4', type: 'Glass-backed', isIndoor: false, x: 0, y: 1 },
    ],
    amenities: [
      { label: 'Free parking', icon: 'ti-parking' },
      { label: 'Pro coaching', icon: 'ti-shopping-bag' },
      { label: 'Changing rooms', icon: 'ti-shirt' },
      { label: 'Floodlit courts', icon: 'ti-bulb' },
    ],
  },
  {
    slug: 'syd-padel-northern-beaches',
    name: 'Northern Beaches Padel',
    region: 'Sydney',
    address: 'Pittwater Road, Manly, Sydney NSW 2095',
    isLive: false,
    courts: [
      { id: 'snb-1', name: 'Court 1', type: 'Glass-backed', isIndoor: false, x: 0, y: 0 },
      { id: 'snb-2', name: 'Court 2', type: 'Glass-backed', isIndoor: false, x: 1, y: 0 },
      { id: 'snb-3', name: 'Court 3', type: 'Glass-backed', isIndoor: false, x: 2, y: 0 },
    ],
    amenities: [
      { label: 'Beachside location', icon: 'ti-bulb' },
      { label: 'Social leagues', icon: 'ti-calendar' },
      { label: 'Equipment rental', icon: 'ti-tools' },
    ],
  },
  // ── AUSTRALIA — MELBOURNE ────────────────────────────────
  {
    slug: 'mel-padel-south-yarra',
    name: 'Padel South Yarra',
    region: 'Melbourne',
    address: '1 Punt Road, South Yarra, Melbourne VIC 3141',
    isLive: false,
    courts: [
      { id: 'msy-1', name: 'Court 1', type: 'Glass-backed', isIndoor: false, x: 0, y: 0 },
      { id: 'msy-2', name: 'Court 2', type: 'Glass-backed', isIndoor: false, x: 1, y: 0 },
      { id: 'msy-3', name: 'Court 3', type: 'Glass-backed', isIndoor: false, x: 2, y: 0 },
      { id: 'msy-4', name: 'Court 4', type: 'Indoor', isIndoor: true, x: 0, y: 1 },
    ],
    amenities: [
      { label: 'Indoor + outdoor', icon: 'ti-shirt' },
      { label: 'Pro shop', icon: 'ti-shopping-bag' },
      { label: 'Cafe on site', icon: 'ti-coffee' },
      { label: 'Free parking', icon: 'ti-parking' },
    ],
  },
  {
    slug: 'mel-padel-st-kilda',
    name: 'Padel St Kilda',
    region: 'Melbourne',
    address: 'Lakeside Drive, Albert Park, Melbourne VIC 3206',
    isLive: false,
    courts: [
      { id: 'msk-1', name: 'Court 1', type: 'Glass-backed', isIndoor: false, x: 0, y: 0 },
      { id: 'msk-2', name: 'Court 2', type: 'Glass-backed', isIndoor: false, x: 1, y: 0 },
      { id: 'msk-3', name: 'Court 3', type: 'Glass-backed', isIndoor: false, x: 2, y: 0 },
    ],
    amenities: [
      { label: 'Lakeside location', icon: 'ti-bulb' },
      { label: 'Social events', icon: 'ti-calendar' },
      { label: 'Coaching available', icon: 'ti-shopping-bag' },
    ],
  },
  // ── AUSTRALIA — BRISBANE ─────────────────────────────────
  {
    slug: 'bri-padel-newstead',
    name: 'Padel Newstead',
    region: 'Brisbane',
    address: 'Breakfast Creek Road, Newstead, Brisbane QLD 4006',
    isLive: false,
    courts: [
      { id: 'bns-1', name: 'Court 1', type: 'Glass-backed', isIndoor: false, x: 0, y: 0 },
      { id: 'bns-2', name: 'Court 2', type: 'Glass-backed', isIndoor: false, x: 1, y: 0 },
      { id: 'bns-3', name: 'Court 3', type: 'Glass-backed', isIndoor: false, x: 2, y: 0 },
      { id: 'bns-4', name: 'Court 4', type: 'Glass-backed', isIndoor: false, x: 0, y: 1 },
    ],
    amenities: [
      { label: 'Free parking', icon: 'ti-parking' },
      { label: 'Floodlit courts', icon: 'ti-bulb' },
      { label: 'Pro coaching', icon: 'ti-shopping-bag' },
      { label: 'Social leagues', icon: 'ti-calendar' },
    ],
  },
  {
    slug: 'bri-padel-west-end',
    name: 'Padel West End',
    region: 'Brisbane',
    address: 'Montague Road, West End, Brisbane QLD 4101',
    isLive: false,
    courts: [
      { id: 'bwe-1', name: 'Court 1', type: 'Glass-backed', isIndoor: false, x: 0, y: 0 },
      { id: 'bwe-2', name: 'Court 2', type: 'Glass-backed', isIndoor: false, x: 1, y: 0 },
      { id: 'bwe-3', name: 'Court 3', type: 'Indoor', isIndoor: true, x: 2, y: 0 },
    ],
    amenities: [
      { label: 'Indoor court available', icon: 'ti-shirt' },
      { label: 'Equipment rental', icon: 'ti-tools' },
      { label: 'Changing rooms', icon: 'ti-shirt' },
    ],
  },
  // ── AUSTRALIA — PERTH ────────────────────────────────────
  {
    slug: 'per-padel-subiaco',
    name: 'Padel Subiaco',
    region: 'Perth',
    address: 'Roberts Road, Subiaco, Perth WA 6008',
    isLive: false,
    courts: [
      { id: 'psu-1', name: 'Court 1', type: 'Glass-backed', isIndoor: false, x: 0, y: 0 },
      { id: 'psu-2', name: 'Court 2', type: 'Glass-backed', isIndoor: false, x: 1, y: 0 },
      { id: 'psu-3', name: 'Court 3', type: 'Glass-backed', isIndoor: false, x: 2, y: 0 },
      { id: 'psu-4', name: 'Court 4', type: 'Glass-backed', isIndoor: false, x: 0, y: 1 },
    ],
    amenities: [
      { label: 'Free parking', icon: 'ti-parking' },
      { label: 'Pro shop', icon: 'ti-shopping-bag' },
      { label: 'Floodlit courts', icon: 'ti-bulb' },
      { label: 'Social events', icon: 'ti-calendar' },
    ],
  },
  {
    slug: 'per-padel-fremantle',
    name: 'Padel Fremantle',
    region: 'Perth',
    address: 'Marine Terrace, Fremantle, Perth WA 6160',
    isLive: false,
    courts: [
      { id: 'pfr-1', name: 'Court 1', type: 'Glass-backed', isIndoor: false, x: 0, y: 0 },
      { id: 'pfr-2', name: 'Court 2', type: 'Glass-backed', isIndoor: false, x: 1, y: 0 },
      { id: 'pfr-3', name: 'Court 3', type: 'Glass-backed', isIndoor: false, x: 2, y: 0 },
    ],
    amenities: [
      { label: 'Harbourside location', icon: 'ti-bulb' },
      { label: 'Coaching available', icon: 'ti-shopping-bag' },
      { label: 'Equipment rental', icon: 'ti-tools' },
    ],
  },
`;

c = c.replace(
  `]\nexport function getVenue`,
  australiaVenues + `]\nexport function getVenue`
);

fs.writeFileSync('lib/venues.ts', c, 'utf8');
console.log('Done');
