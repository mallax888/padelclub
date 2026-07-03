const fs = require('fs');
const c = fs.readFileSync('components/booking/MyBookingsList.tsx', 'utf8');
const idx = c.indexOf('return (\n\n');
if (idx === -1) {
  console.log('Pattern not found via that search, trying alternate');
  const idx2 = c.indexOf('venue.address');
  console.log(JSON.stringify(c.slice(idx2 - 150, idx2 + 50)));
} else {
  console.log(JSON.stringify(c.slice(idx - 20, idx + 150)));
}
