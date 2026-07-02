const fs = require('fs');
let c = fs.readFileSync('components/booking/MyBookingsList.tsx', 'utf8');

c = c.replace(
  `<div className="flex flex-col items-end gap-0.5">`,
  `<div className="flex flex-col items-center gap-1">`
);

c = c.replace(
  `<span className="text-[10px]" style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{isLateCancel ? '50% credit' : 'Full refund'}</span>`,
  `<span className="text-xs text-center" style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{isLateCancel ? '50% credit' : 'Full refund'}</span>`
);

fs.writeFileSync('components/booking/MyBookingsList.tsx', c, 'utf8');
console.log('Centered wrapper fixed:', c.includes('flex flex-col items-center gap-1'));
console.log('Text size fixed:', c.includes('text-xs text-center'));
