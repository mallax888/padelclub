const fs = require('fs');
const path = 'app/api/record-match/route.ts';
let c = fs.readFileSync(path, 'utf8');

const target = "  const admin = createAdminClient()";
const replacement = "  const admin = createAdminClient() as any";

console.log('Target found:', c.includes(target));
c = c.replace(target, replacement);
fs.writeFileSync(path, c, 'utf8');
console.log('Cast to any added:', c.includes('const admin = createAdminClient() as any'));
