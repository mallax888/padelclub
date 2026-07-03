const fs = require('fs');
const path = 'components/matches/RecordMatchForm.tsx';
let c = fs.readFileSync(path, 'utf8');

const target1 = "import toast from 'react-hot-toast'";
const replacement1 = "import toast from 'react-hot-toast'\nimport { playNumberSound } from '@/lib/sounds'";

const target2 = "  const Stepper = ({ value, onChange, color }: { value: number; onChange: (n: number) => void; color: string }) => (\n    <div className=\"flex flex-col items-center gap-3\">\n      <div style={{ fontSize: 88, fontWeight: 900, lineHeight: 1, color, minWidth: 100, textAlign: 'center' }}>{value}</div>\n      <div className=\"flex items-center gap-3\">\n        <button\n          onClick={() => onChange(Math.max(0, value - 1))}\n          className=\"flex items-center justify-center rounded-lg font-bold transition-all\"\n          style={{ width: 48, height: 44, background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 22 }}\n          onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.color = color }}\n          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-primary)' }}\n        >\u2013</button>\n        <button\n          onClick={() => onChange(Math.min(7, value + 1))}\n          className=\"flex items-center justify-center rounded-lg font-bold transition-all\"\n          style={{ width: 48, height: 44, background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 22 }}\n          onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.color = color }}\n          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-primary)' }}\n        >+</button>\n      </div>\n    </div>\n  )";

const replacement2 = "  const TapZone = ({ value, onChange, color, bg }: { value: number; onChange: (n: number) => void; color: string; bg: string }) => (\n    <div className=\"flex flex-col items-center gap-2\" style={{ flex: 1 }}>\n      <div\n        onClick={() => { onChange(value >= 7 ? 0 : value + 1); playNumberSound() }}\n        className=\"w-full flex items-center justify-center rounded-xl cursor-pointer select-none transition-all active:scale-95\"\n        style={{ height: 110, background: bg, border: `1.5px solid ${color}` }}\n      >\n        <span style={{ fontSize: 64, fontWeight: 900, lineHeight: 1, color }}>{value}</span>\n      </div>\n      <button onClick={() => onChange(0)} className=\"text-xs font-medium\" style={{ color: 'var(--text-muted)' }}>reset</button>\n    </div>\n  )";

console.log('Target 1 found:', c.includes(target1));
console.log('Target 2 found:', c.includes(target2));

c = c.replace(target1, replacement1);
c = c.replace(target2, replacement2);

const target3 = "              <Stepper value={draftT1} onChange={setDraftT1} color=\"var(--brand-primary)\" />\n              <span style={{ fontSize: 28, fontWeight: 200, color: 'var(--text-muted)' }}>\u2013</span>\n              <Stepper value={draftT2} onChange={setDraftT2} color=\"var(--brand-accent)\" />";
const replacement3 = "              <TapZone value={draftT1} onChange={setDraftT1} color=\"var(--brand-primary)\" bg=\"var(--brand-primary-muted)\" />\n              <span style={{ fontSize: 28, fontWeight: 200, color: 'var(--text-muted)' }}>\u2013</span>\n              <TapZone value={draftT2} onChange={setDraftT2} color=\"var(--brand-accent)\" bg=\"var(--brand-accent-muted)\" />";

console.log('Target 3 found:', c.includes(target3));
c = c.replace(target3, replacement3);

fs.writeFileSync(path, c, 'utf8');
console.log('Sound import added:', c.includes("import { playNumberSound } from '@/lib/sounds'"));
console.log('TapZone component added:', c.includes('const TapZone ='));
console.log('TapZone used in SetRow:', c.includes('<TapZone value={draftT1}'));
