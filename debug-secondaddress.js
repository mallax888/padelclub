const fs = require('fs');
const c = fs.readFileSync('components/booking/MyBookingsList.tsx', 'utf8');
const first = c.indexOf('venue.address');
const second = c.indexOf('venue.address', first + 1);
console.log(JSON.stringify(c.slice(second - 60, second + 30)));
