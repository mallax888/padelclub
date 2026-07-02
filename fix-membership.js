const fs = require('fs');
let c = fs.readFileSync('components/membership/MembershipPanel.tsx', 'utf8');

// Fix 1: bolder, bigger checkmarks
c = c.replace(
  `<span className="mt-0.5 shrink-0" style={{ color: 'var(--brand-primary)' }}>✓</span>`,
  `<span className="mt-0.5 shrink-0" style={{ color: 'var(--brand-primary)', fontWeight: 700, fontSize: '0.95rem' }}>✓</span>`
);

// Fix 2: distinct "Current plan" button treatment (outline style + checkmark) instead of just dimmed primary
c = c.replace(
  `<button
                className="btn btn-primary w-full justify-center mt-4"
                disabled={isCurrent || upgrading}
                style={{
                  cursor: isCurrent ? 'default' : 'pointer',
                  opacity: isCurrent ? 0.5 : 1,
                }}
                onClick={() => handleUpgrade(mem.id as MembershipTier)}
              >
                {isCurrent ? 'Current plan' : \`Select \${mem.name}\`}
              </button>`,
  `<button
                className={isCurrent ? 'btn w-full justify-center mt-4' : 'btn btn-primary w-full justify-center mt-4'}
                disabled={isCurrent || upgrading}
                style={{
                  cursor: isCurrent ? 'default' : 'pointer',
                  background: isCurrent ? 'var(--brand-primary-muted)' : undefined,
                  color: isCurrent ? 'var(--brand-primary)' : undefined,
                  border: isCurrent ? '1px solid var(--brand-primary)' : undefined,
                  fontWeight: 600,
                }}
                onClick={() => handleUpgrade(mem.id as MembershipTier)}
              >
                {isCurrent ? '✓ Current plan' : \`Select \${mem.name}\`}
              </button>`
);

// Fix 3: date column - bump from text-subtle to text-muted for better legibility
c = c.replace(
  `<td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-subtle)' }}>
                      {tx.created_at.slice(0, 10)}
                    </td>`,
  `<td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
                      {tx.created_at.slice(0, 10)}
                    </td>`
);

fs.writeFileSync('components/membership/MembershipPanel.tsx', c, 'utf8');
console.log('Checkmarks fixed:', c.includes("fontWeight: 700, fontSize: '0.95rem'"));
console.log('Current plan button fixed:', c.includes("✓ Current plan"));
console.log('Date column fixed:', c.includes("color: 'var(--text-muted)', fontWeight: 500"));
