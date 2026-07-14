const fs = require('fs');
const path = 'app/(app)/mybookings/page.tsx';
let c = fs.readFileSync(path, 'utf8');

const target = ".select('*, bookings(date, start_time, end_time, courts(name, type)), profiles!booking_splits_invited_by_fkey(nickname, full_name)')\n      .eq('user_id', session!.user.id)\n      .eq('status', 'pending'),";
const replacement = ".select('*, bookings(date, start_time, end_time, courts(name, type, venue_slug)), profiles!booking_splits_invited_by_fkey(nickname, full_name)')\n      .eq('user_id', session!.user.id)\n      .eq('status', 'pending'),";

console.log('Target found:', c.includes(target));
c = c.replace(target, replacement);
fs.writeFileSync(path, c, 'utf8');
console.log('venue_slug added:', c.includes('courts(name, type, venue_slug)'));
