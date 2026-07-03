const fs = require('fs');
const c = fs.readFileSync('components/booking/MyBookingsList.tsx', 'utf8');
const idx = c.indexOf('durationLabel(b.duration_minutes)');
console.log(JSON.stringify(c.slice(idx - 100, idx + 200)));
