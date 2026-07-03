const fs = require('fs');
const c = fs.readFileSync('components/booking/MyBookingsList.tsx', 'utf8');
const idx = c.indexOf('venue.address');
console.log(JSON.stringify(c.slice(idx - 150, idx + 30)));
