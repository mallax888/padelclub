const fs = require('fs');
let c = fs.readFileSync('components/booking/MyBookingsList.tsx', 'utf8');

// Fix 1: make status badge unmistakably a pill, not flat text
c = c.replace(
  `<span className={cn('badge', 'status-' + b.status)} style={{ flexShrink: 0 }}>{b.status}</span>`,
  `<span className={cn('badge', 'status-' + b.status)} style={{ flexShrink: 0, fontWeight: 700, padding: '4px 12px' }}>{b.status}</span>`
);

// Fix 2: brighter, bolder refund helper text
c = c.replace(
  `<span className="text-[10px]" style={{ color: 'var(--text-subtle)' }}>{isLateCancel ? '50% credit' : 'Full refund'}</span>`,
  `<span className="text-[10px]" style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{isLateCancel ? '50% credit' : 'Full refund'}</span>`
);

fs.writeFileSync('components/booking/MyBookingsList.tsx', c, 'utf8');
console.log('Status badge fixed:', c.includes("fontWeight: 700, padding: '4px 12px'"));
console.log('Refund text fixed:', c.includes("color: 'var(--text-muted)', fontWeight: 600"));
