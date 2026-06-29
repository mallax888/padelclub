const fs = require('fs');
let c = fs.readFileSync('components/booking/BookingFlow.tsx', 'utf8');
c = c.replace(
  /export default function BookingFlow\(\{\s*courts,\s*profile,\s*userId,\s*\}: \{\s*courts: Court\[\]\s*profile: Profile\s*userId: string\s*\}\)/,
  "export default function BookingFlow({\n    courts,\n    profile,\n    userId,\n    allPlayers = [],\n  }: {\n    courts: Court[]\n    profile: Profile\n    userId: string\n    allPlayers?: { id: string; full_name: string | null; nickname: string | null }[]\n  })"
);
fs.writeFileSync('components/booking/BookingFlow.tsx', c, 'utf8');
console.log('Done - signature:', c.includes('allPlayers') ? 'OK' : 'FAILED');
