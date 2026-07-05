const fs = require('fs');
const path = 'app/(app)/mybookings/page.tsx';
let c = fs.readFileSync(path, 'utf8');

const target = ".select('*, bookings(*, courts(*), booking_splits(user_id, status, profiles(nickname, full_name))), profiles!booking_splits_invited_by_fkey(nickname, full_name)')";
const replacement = ".select('*, bookings(*, courts(*), booking_splits(user_id, status, profiles!booking_splits_user_id_fkey(nickname, full_name))), profiles!booking_splits_invited_by_fkey(nickname, full_name)')";

console.log('Target found:', c.includes(target));
c = c.replace(target, replacement);
fs.writeFileSync(path, c, 'utf8');
console.log('FK disambiguated:', c.includes('booking_splits(user_id, status, profiles!booking_splits_user_id_fkey'));
