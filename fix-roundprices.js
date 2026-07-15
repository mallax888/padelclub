const fs = require('fs');
const path = 'components/booking/BookingFlow.tsx';
let c = fs.readFileSync(path, 'utf8');
const results = {};

const swaps = [
  ["const courtPrice = court && duration ? basePrice * (1 - discount) * duration : 0",
   "const courtPrice = court && duration ? Math.round(basePrice * (1 - discount) * duration) : 0"],
  ["{formatPrice(c.price_per_hour * (1 - discount), currency)}/hr",
   "{formatPrice(Math.round(c.price_per_hour * (1 - discount)), currency)}/hr"],
  ["from {formatPrice(court.price_per_hour * (1 - discount) * d.value, currency)}",
   "from {formatPrice(Math.round(court.price_per_hour * (1 - discount) * d.value), currency)}"],
  ["formatPrice(courtPrice / (splitPlayers.length + 1), currency)} each",
   "formatPrice(Math.round(courtPrice / (splitPlayers.length + 1)), currency)} each"],
  ["You pay {formatPrice(courtPrice / (splitPlayers.length + 1), currency)} - others notified to pay their share",
   "You pay {formatPrice(Math.round(courtPrice / (splitPlayers.length + 1)), currency)} - others notified to pay their share"],
  ["`Pay ${formatPrice(splitEnabled && splitPlayers.length > 0 ? courtPrice / (splitPlayers.length + 1) : courtPrice, currency)} \u2192`",
   "`Pay ${formatPrice(Math.round(splitEnabled && splitPlayers.length > 0 ? courtPrice / (splitPlayers.length + 1) : courtPrice), currency)} \u2192`"],
];

swaps.forEach(([bad, good], i) => {
  results[`swap ${i+1} found`] = c.includes(bad);
  c = c.split(bad).join(good);
});

fs.writeFileSync(path, c, 'utf8');
Object.entries(results).forEach(([k, v]) => console.log(k + ':', v));
