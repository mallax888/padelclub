const fs = require('fs');
const path = 'components/matches/RecordMatchForm.tsx';
let c = fs.readFileSync(path, 'utf8');

const target1 = "import { playNumberSound } from '@/lib/sounds'";
const replacement1 = "import { playWheelClick } from '@/lib/sounds'";

const target2 = "onClick={() => { onChange(value >= 7 ? 0 : value + 1); playNumberSound() }}";
const replacement2 = "onClick={() => { onChange(value >= 7 ? 0 : value + 1); playWheelClick() }}";

console.log('Target 1 found:', c.includes(target1));
console.log('Target 2 found:', c.includes(target2));

c = c.replace(target1, replacement1);
c = c.replace(target2, replacement2);

fs.writeFileSync(path, c, 'utf8');
console.log('Import swapped:', c.includes("import { playWheelClick } from '@/lib/sounds'"));
console.log('Tap handler swapped:', c.includes('playWheelClick()'));
