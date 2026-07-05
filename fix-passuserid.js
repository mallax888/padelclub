const fs = require('fs');
const path = 'app/(app)/mybookings/page.tsx';
let c = fs.readFileSync(path, 'utf8');

const target = "<MyBookingsList bookings={bookings ?? []} profile={profile!} splitRequests={splitRequests ?? []} outgoingSplits={outgoingSplits ?? []} joinedGames={joinedGames ?? []} />";
const replacement = "<MyBookingsList bookings={bookings ?? []} profile={profile!} splitRequests={splitRequests ?? []} outgoingSplits={outgoingSplits ?? []} joinedGames={joinedGames ?? []} currentUserId={session!.user.id} />";

console.log('Target found:', c.includes(target));
c = c.replace(target, replacement);
fs.writeFileSync(path, c, 'utf8');
console.log('currentUserId prop added:', c.includes('currentUserId={session!.user.id}'));
