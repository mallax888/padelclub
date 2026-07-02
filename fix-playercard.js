const fs = require('fs');
let c = fs.readFileSync('components/players/PlayerCard.tsx', 'utf8');

// Fix 1: rank badge circle - more contrast, bolder
c = c.replace(
  `style={{ background: 'var(--bg-base)', color: 'var(--text-subtle)', border: '1px solid var(--border)' }}`,
  `style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', border: '1px solid var(--brand-primary)', fontWeight: 800 }}`
);

// Fix 2: tier text (#N . beginner . casual) - bump from text-muted (already ok) but keep, skip
// Fix 3: stat labels (Points / Wins / Losses) - bolder and brighter
c = c.replaceAll(
  `<div className="text-[10px]" style={{ color: 'var(--text-subtle)' }}>Points</div>`,
  `<div className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>Points</div>`
);
c = c.replaceAll(
  `<div className="text-[10px]" style={{ color: 'var(--text-subtle)' }}>Wins</div>`,
  `<div className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>Wins</div>`
);
c = c.replaceAll(
  `<div className="text-[10px]" style={{ color: 'var(--text-subtle)' }}>Losses</div>`,
  `<div className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>Losses</div>`
);

fs.writeFileSync('components/players/PlayerCard.tsx', c, 'utf8');
console.log('Rank badge fixed:', c.includes("border: '1px solid var(--brand-primary)', fontWeight: 800"));
console.log('Points label fixed:', c.includes('font-semibold" style={{ color: \'var(--text-muted)\' }}>Points'));
console.log('Wins label fixed:', c.includes('font-semibold" style={{ color: \'var(--text-muted)\' }}>Wins'));
console.log('Losses label fixed:', c.includes('font-semibold" style={{ color: \'var(--text-muted)\' }}>Losses'));
