const fs = require('fs');
let c = fs.readFileSync('components/matches/FindGameList.tsx', 'utf8');

// Fix 1: empty player slot circles
c = c.replace(
  `border: '2px dashed var(--border)',
                        color: 'var(--text-subtle)',`,
  `border: '2px dashed rgba(128,128,128,0.5)',
                        color: 'rgba(128,128,128,0.9)',
                        fontWeight: 700,`
);

// Fix 2: organizing banner
c = c.replace(
  `style={{ background: 'var(--bg-raised)', color: 'var(--text-subtle)' }}>
                You're organizing this match`,
  `style={{ background: 'var(--bg-raised)', color: 'var(--text-primary)', fontWeight: 600 }}>
                You're organizing this match`
);

// Fix 3: skill level text
c = c.replace(
  `className="text-xs mb-3" style={{ color: 'var(--text-subtle)' }}>
              Skill level:`,
  `className="text-xs mb-3" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
              Skill level:`
);

fs.writeFileSync('components/matches/FindGameList.tsx', c, 'utf8');
console.log('Empty slots fixed:', c.includes('rgba(128,128,128,0.5)'));
console.log('Banner fixed:', c.includes("color: 'var(--text-primary)', fontWeight: 600"));
console.log('Skill text fixed:', c.includes("color: 'var(--text-muted)', fontWeight: 500"));
