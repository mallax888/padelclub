const fs = require('fs');
const path = 'components/booking/BookingFlow.tsx';
let c = fs.readFileSync(path, 'utf8');
const results = {};

// 1. Add import
const target1 = "import { formatNzd, formatDate, generateTimeSlots, addHours } from '@/lib/utils'";
const replacement1 = "import { formatNzd, formatDate, generateTimeSlots, addHours } from '@/lib/utils'\nimport { currencyForRegion, formatPrice } from '@/lib/currency'";
results['import added'] = c.includes(target1);
c = c.replace(target1, replacement1);

// 2. Add currency computation right after venue state declaration
const target2 = "const [venue, setVenue] = useState<Venue | null>(null)";
const replacement2 = "const [venue, setVenue] = useState<Venue | null>(null)\n  const currency = currencyForRegion(venue?.region)";
results['currency var added'] = c.includes(target2);
c = c.replace(target2, replacement2);

// 3. Replace each formatNzd usage individually
const swaps = [
  ["formatNzd(splitAmount)", "formatPrice(splitAmount, currency)"],
  ["formatNzd(c.price_per_hour * (1 - discount))", "formatPrice(c.price_per_hour * (1 - discount), currency)"],
  ["formatNzd(court.price_per_hour * (1 - discount) * d.value)", "formatPrice(court.price_per_hour * (1 - discount) * d.value, currency)"],
  ["formatNzd(courtPrice)", "formatPrice(courtPrice, currency)"],
  ["formatNzd(courtPrice / (splitPlayers.length + 1))", "formatPrice(courtPrice / (splitPlayers.length + 1), currency)"],
  ["formatNzd(splitEnabled && splitPlayers.length > 0 ? courtPrice / (splitPlayers.length + 1) : courtPrice)", "formatPrice(splitEnabled && splitPlayers.length > 0 ? courtPrice / (splitPlayers.length + 1) : courtPrice, currency)"],
];

swaps.forEach(([bad, good], i) => {
  const found = c.includes(bad);
  results[`swap ${i+1} found`] = found;
  c = c.split(bad).join(good);
});

fs.writeFileSync(path, c, 'utf8');

Object.entries(results).forEach(([k, v]) => console.log(k + ':', v));
console.log('Remaining formatNzd price calls:', (c.match(/formatNzd\(/g) || []).length, '(should be 0 or close to 0, ignore the import line itself)');
