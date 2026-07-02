const fs = require('fs');
const c = fs.readFileSync('components/booking/MyBookingsList.tsx', 'utf8');
const idx = c.indexOf("isLateCancel ? '50% credit'");
console.log(JSON.stringify(c.slice(idx - 100, idx + 150)));
