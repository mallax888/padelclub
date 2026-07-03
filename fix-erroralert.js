const fs = require('fs');
const path = 'components/matches/RecordMatchForm.tsx';
let c = fs.readFileSync(path, 'utf8');

const target = "if (error) { toast.error('Could not record match'); setSubmitting(false); return }";
const replacement = "if (error) { toast.error('Could not record match: ' + error.message); console.error('Record match error:', error); setSubmitting(false); return }";

console.log('Target found:', c.includes(target));
c = c.replace(target, replacement);
fs.writeFileSync(path, c, 'utf8');
console.log('Debug error message added:', c.includes("'Could not record match: ' + error.message"));
