const fs = require('fs');
const path = 'components/booking/MyBookingsList.tsx';
let c = fs.readFileSync(path, 'utf8');

const target = "{venue && (\n\n                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.address)}`}\n                target=\"_blank\"\n                rel=\"noopener noreferrer\"\n                className=\"inline-flex items-center gap-1.5 text-sm font-semibold mt-1.5\"\n                style={{ color: 'var(--brand-primary)' }}\n              >";
const replacement = "{venue && (\n              <a\n                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.address)}`}\n                target=\"_blank\"\n                rel=\"noopener noreferrer\"\n                className=\"inline-flex items-center gap-1.5 text-sm font-semibold mt-1.5\"\n                style={{ color: 'var(--brand-primary)' }}\n              >";

console.log('Target found:', c.includes(target));
c = c.replace(target, replacement);
fs.writeFileSync(path, c, 'utf8');

const openTags = (c.match(/<a\b/g) || []).length;
const closeTags = (c.match(/<\/a>/g) || []).length;
console.log('<a> tags total:', openTags);
console.log('</a> tags total:', closeTags);
console.log('Balanced:', openTags === closeTags);
