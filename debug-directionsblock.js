const fs = require('fs');
const c = fs.readFileSync('components/booking/MyBookingsList.tsx', 'utf8');
const idx = c.indexOf('{!past && (() => {');
const end = c.indexOf('})()}', idx) + '})()}'.length;
console.log(JSON.stringify(c.slice(idx, end)));
