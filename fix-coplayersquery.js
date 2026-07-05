const fs = require('fs');
const path = 'app/(app)/mybookings/page.tsx';
let c = fs.readFileSync(path, 'utf8');

const target = `    supabase
      .from('booking_splits')
      .select('*, bookings(*, courts(*)), profiles!booking_splits_invited_by_fkey(nickname, full_name)')
      .eq('user_id', session!.user.id)
      .eq('status', 'paid'),`;

const replacement = `    supabase
      .from('booking_splits')
      .select('*, bookings(*, courts(*), booking_splits(user_id, status, profiles(nickname, full_name))), profiles!booking_splits_invited_by_fkey(nickname, full_name)')
      .eq('user_id', session!.user.id)
      .eq('status', 'paid'),`;

console.log('Target found:', c.includes(target));
c = c.replace(target, replacement);
fs.writeFileSync(path, c, 'utf8');
console.log('Nested booking_splits added:', c.includes('booking_splits(user_id, status, profiles(nickname, full_name))'));
