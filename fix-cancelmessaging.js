const fs = require('fs');
const path = 'components/booking/MyBookingsList.tsx';
const c = fs.readFileSync(path, 'utf8');

const idx = c.indexOf('const handleCancel');
const endMarker = 'setCancelling(null)\n  }';
const end = c.indexOf(endMarker, idx) + endMarker.length;

if (idx === -1 || end === -1) {
  console.log('Could not locate handleCancel boundaries. idx:', idx, 'end:', end);
  process.exit(1);
}

console.log('--- Current handleCancel ---');
console.log(JSON.stringify(c.slice(idx, end)));
