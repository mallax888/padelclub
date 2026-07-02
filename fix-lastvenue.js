const fs = require('fs');
const path = 'components/booking/BookingFlow.tsx';
let c = fs.readFileSync(path, 'utf8');

const target1 = `  }: {
    courts: Court[]
    profile: Profile
    userId: string
    allPlayers?: { id: string; full_name: string | null; nickname: string | null }[]
  }) {`;
const replacement1 = `    lastVenueSlug = null,
  }: {
    courts: Court[]
    profile: Profile
    userId: string
    allPlayers?: { id: string; full_name: string | null; nickname: string | null }[]
    lastVenueSlug?: string | null
  }) {`;

const target2 = `  const [step, setStep] = useState<Step>('country')
  const [country, setCountry] = useState<string | null>(null)
  const [region, setRegion] = useState<string | null>(null)
  const [venue, setVenue] = useState<Venue | null>(null)`;
const replacement2 = `  const initialVenue = lastVenueSlug ? VENUES.find(v => v.slug === lastVenueSlug) ?? null : null
  const initialCountry = initialVenue ? COUNTRIES.find(c => c.regions.includes(initialVenue.region))?.name ?? null : null
  const [step, setStep] = useState<Step>(initialVenue ? 'date' : 'country')
  const [country, setCountry] = useState<string | null>(initialCountry)
  const [region, setRegion] = useState<string | null>(initialVenue?.region ?? null)
  const [venue, setVenue] = useState<Venue | null>(initialVenue)`;

console.log('Target 1 found:', c.includes(target1));
console.log('Target 2 found:', c.includes(target2));

c = c.replace(target1, replacement1);
c = c.replace(target2, replacement2);

fs.writeFileSync(path, c, 'utf8');
console.log('Prop added:', c.includes('lastVenueSlug?: string | null'));
console.log('Skip logic added:', c.includes("useState<Step>(initialVenue ? 'date' : 'country')"));
