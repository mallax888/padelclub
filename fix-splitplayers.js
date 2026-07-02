const fs = require('fs');
const path = 'app/(app)/book/page.tsx';
let c = fs.readFileSync(path, 'utf8');

const target = `.not('role', 'in', '("staff","admin")')`;
const replacement = `.not('role', 'eq', 'staff')`;

console.log('Target found:', c.includes(target));
c = c.replace(target, replacement);
fs.writeFileSync(path, c, 'utf8');
console.log('Fixed:', c.includes(replacement));
