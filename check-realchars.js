const fs = require('fs');
const c = fs.readFileSync('app/(app)/players/[id]/page.tsx', 'utf8');
const idx = c.indexOf('Back to players');
console.log(JSON.stringify(c.slice(idx - 10, idx)));
