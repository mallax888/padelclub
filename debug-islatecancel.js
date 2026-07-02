const fs = require('fs');
const c = fs.readFileSync('components/booking/MyBookingsList.tsx', 'utf8');
const idx = c.indexOf('const isLateCancel');
console.log(JSON.stringify(c.slice(idx - 50, idx + 200)));
