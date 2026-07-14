const fs = require('fs');
const path = 'app/(app)/players/[id]/page.tsx';
let c = fs.readFileSync(path, 'utf8');

const fixes = [
  ['â† Back to players', '\u2190 Back to players'],
  ['Head to head â€" count opponents and results', 'Head to head \u2014 count opponents and results'],
  ['>â€"</span>', '>\u2013</span>'],
  [" Â· with ", " \u00b7 with "],
];

let counts = [];
for (const [bad, good] of fixes) {
  const before = c.split(bad).length - 1;
  c = c.split(bad).join(good);
  counts.push(`"${bad}" found ${before}x`);
}

fs.writeFileSync(path, c, 'utf8');
counts.forEach(x => console.log(x));
console.log('Remaining mojibake (â or Â chars):', (c.match(/[â][€†]|Â/g) || []).length);
