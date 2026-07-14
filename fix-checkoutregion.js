const fs = require('fs');
const path = 'components/booking/BookingFlow.tsx';
let c = fs.readFileSync(path, 'utf8');

const target = `      body: JSON.stringify({
        bookingId: bookingData.id,
        courtName: court.name + ' — ' + court.type,
        date: formatDate(date),
        time: time + ' — ' + endTime,
        amount: courtPrice,
        splitCount: makePublic ? 4 : 1,
      }),`;
const replacement = `      body: JSON.stringify({
        bookingId: bookingData.id,
        courtName: court.name + ' — ' + court.type,
        date: formatDate(date),
        time: time + ' — ' + endTime,
        amount: courtPrice,
        splitCount: makePublic ? 4 : 1,
        region: venue?.region,
      }),`;

console.log('Target found:', c.includes(target));
c = c.replace(target, replacement);
fs.writeFileSync(path, c, 'utf8');
console.log('Region param added:', c.includes('region: venue?.region,'));
