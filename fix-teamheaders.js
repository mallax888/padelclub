const fs = require('fs');
const path = 'components/matches/RecordMatchForm.tsx';
let c = fs.readFileSync(path, 'utf8');

const target1 = `<div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--brand-primary)' }}>Team 1</div>`;
const replacement1 = `<div className="text-sm font-extrabold uppercase tracking-wide mb-3" style={{ color: 'var(--brand-primary)' }}>Team 1</div>`;

const target2 = `<div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--brand-accent)' }}>Team 2</div>`;
const replacement2 = `<div className="text-sm font-extrabold uppercase tracking-wide mb-3" style={{ color: 'var(--brand-accent)' }}>Team 2</div>`;

const target3 = `<div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-primary)' }}>Score</div>`;
const replacement3 = `<div className="text-sm font-extrabold uppercase tracking-wide" style={{ color: 'var(--text-primary)' }}>Score</div>`;

console.log('Target 1 (Team 1) found:', c.includes(target1));
console.log('Target 2 (Team 2) found:', c.includes(target2));
console.log('Target 3 (Score) found:', c.includes(target3));

c = c.replace(target1, replacement1);
c = c.replace(target2, replacement2);
c = c.replace(target3, replacement3);

fs.writeFileSync(path, c, 'utf8');
console.log('All three bolder:', c.includes('text-sm font-extrabold uppercase tracking-wide mb-3" style={{ color: \'var(--brand-primary)\'') && c.includes('text-sm font-extrabold uppercase tracking-wide mb-3" style={{ color: \'var(--brand-accent)\''));
