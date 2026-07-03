const fs = require('fs');
const c = fs.readFileSync('components/matches/RecordMatchForm.tsx', 'utf8');
const idx = c.indexOf('const Stepper');
const end = c.indexOf('  )', idx) + '  )'.length;
console.log(JSON.stringify(c.slice(idx, end)));
