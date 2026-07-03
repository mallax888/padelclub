const fs = require('fs');
const path = 'components/booking/MyBookingsList.tsx';
let c = fs.readFileSync(path, 'utf8');

const target = "{!past && venue && (\n              \n                href={";
const replacement = "{!past && venue && (\n              <a\n                href={";

console.log('Target found:', c.includes(target));
c = c.replace(target, replacement);
fs.writeFileSync(path, c, 'utf8');
console.log('<a> tag restored:', c.includes("{!past && venue && (\n              <a\n                href="));
console.log('Total <a tags in file now:', (c.match(/<a\b/g) || []).length);
console.log('Total </a> tags in file now:', (c.match(/<\/a>/g) || []).length);
