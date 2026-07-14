const fs = require('fs');
const path = 'components/booking/MyBookingsList.tsx';
let c = fs.readFileSync(path, 'utf8');

const target = "DirectionsButton = ({ address }: { address: string }) => (\n  \n    href={";
const replacement = "DirectionsButton = ({ address }: { address: string }) => (\n  <a\n    href={";

console.log('Target found:', c.includes(target));
c = c.replace(target, replacement);
fs.writeFileSync(path, c, 'utf8');

const o = (c.match(/<a\b/g) || []).length;
const cl = (c.match(/<\/a>/g) || []).length;
console.log('Open a tags:', o);
console.log('Close a tags:', cl);
console.log('Balanced:', o === cl);
