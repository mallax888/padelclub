const fs = require('fs');
const c = fs.readFileSync('app/api/stripe-webhook/route.ts', 'utf8');
const idx = c.indexOf('bookingId, userId, splitId, type');
if (idx === -1) {
  console.log('String "bookingId, userId, splitId, type" not found at all');
} else {
  const snippet = c.slice(idx - 20, idx + 150);
  console.log(JSON.stringify(snippet));
}
