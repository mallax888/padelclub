const fs = require('fs');
const path = 'components/booking/MyBookingsList.tsx';
let c = fs.readFileSync(path, 'utf8');

const target1 = `interface SplitRequest {
  id: string
  booking_id: string
  amount_nzd: number
  status: string
  bookings: {
    date: string
    start_time: string
    end_time: string
    courts: { name: string; type: string } | null
  } | null
  profiles: { nickname: string | null; full_name: string | null } | null
}`;
const replacement1 = `interface SplitRequest {
  id: string
  booking_id: string
  amount_nzd: number
  status: string
  bookings: {
    date: string
    start_time: string
    end_time: string
    courts: { name: string; type: string; venue_slug?: string } | null
  } | null
  profiles: { nickname: string | null; full_name: string | null } | null
}`;

console.log('Target 1 found:', c.includes(target1));
c = c.replace(target1, replacement1);

const target2 = `                      const res = await fetch('/api/pay-split', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ splitId: s.id, amount: s.amount_nzd, courtName: court, date, time, invitedByName }),
                      })`;
const replacement2 = `                      const region = VENUES.find(v => v.slug === s.bookings?.courts?.venue_slug)?.region
                      const res = await fetch('/api/pay-split', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ splitId: s.id, amount: s.amount_nzd, courtName: court, date, time, invitedByName, region }),
                      })`;

console.log('Target 2 found:', c.includes(target2));
c = c.replace(target2, replacement2);

fs.writeFileSync(path, c, 'utf8');
console.log('venue_slug in interface:', c.includes('venue_slug?: string'));
console.log('region passed to pay-split:', c.includes('body: JSON.stringify({ splitId: s.id, amount: s.amount_nzd, courtName: court, date, time, invitedByName, region })'));
