const fs = require('fs');
const path = 'components/booking/MyBookingsList.tsx';
let c = fs.readFileSync(path, 'utf8');

const target = `              return (

                  href={\`https://www.google.com/maps/search/?api=1&query=\${encodeURIComponent(venue.address)}\`}`;
const replacement = `              return (
                
                  href={\`https://www.google.com/maps/search/?api=1&query=\${encodeURIComponent(venue.address)}\`}`;

console.log('Target found:', c.includes(target));
c = c.replace(target, replacement);
fs.writeFileSync(path, c, 'utf8');
console.log('<a> tag restored:', c.includes('              return (\n                <a\n                  href='));
