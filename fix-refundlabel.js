const fs = require('fs');
const path = 'components/booking/MyBookingsList.tsx';
let c = fs.readFileSync(path, 'utf8');

const target1 = `const isLateCancel = hoursUntil < 24`;
const replacement1 = `const isLateCancel = hoursUntil < 24
  const isPaid = !!b.stripe_payment_id`;

const target2 = `{isLateCancel ? '50% credit' : 'Full refund'}`;
const replacement2 = `{!isPaid ? 'No charge' : isLateCancel ? '50% credit' : 'Full refund'}`;

console.log('Target 1 found:', c.includes(target1));
console.log('Target 2 found:', c.includes(target2));

c = c.replace(target1, replacement1);
c = c.replace(target2, replacement2);

fs.writeFileSync(path, c, 'utf8');
console.log('isPaid variable added:', c.includes('const isPaid = !!b.stripe_payment_id'));
console.log('Label logic updated:', c.includes("!isPaid ? 'No charge'"));
