const fs = require('fs');
const path = 'app/globals.css';
let c = fs.readFileSync(path, 'utf8');

const target = `  .label {
    @apply block text-xs font-medium uppercase tracking-wide mb-1.5 select-none;
    color: var(--text-muted);
  }`;
const replacement = `  .label {
    @apply block text-xs font-bold uppercase tracking-wide mb-1.5 select-none;
    color: var(--text-primary);
  }`;

console.log('Target found:', c.includes(target));
c = c.replace(target, replacement);
fs.writeFileSync(path, c, 'utf8');
console.log('Label bolder/brighter:', c.includes('font-bold uppercase tracking-wide mb-1.5 select-none'));
