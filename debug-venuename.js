const fs = require('fs');
const c = fs.readFileSync('components/booking/MyBookingsList.tsx', 'utf8');
const idx = c.indexOf('{b.courts?.name} — {b.courts?.type}');
console.log(JSON.stringify(c.slice(idx - 50, idx + 300)));
