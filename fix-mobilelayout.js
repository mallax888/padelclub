const fs = require('fs');
const path = 'components/booking/MyBookingsList.tsx';
let c = fs.readFileSync(path, 'utf8');

// Fix 1: BookingRow header - stack on mobile, row on larger screens
const target1 = `      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-12 h-12 rounded-lg flex items-center justify-center text-xl shrink-0" style={{ background: 'var(--brand-primary-muted)' }}>
            🎾
          </div>`;
const replacement1 = `      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-12 h-12 rounded-lg flex items-center justify-center text-xl shrink-0" style={{ background: 'var(--brand-primary-muted)' }}>
            🎾
          </div>`;

console.log('Target 1 found:', c.includes(target1));
c = c.replace(target1, replacement1);

// Fix 2: BookingRow price/status block - horizontal row on mobile, right-aligned block on larger screens
const target2 = `        <div className="text-right shrink-0">
          <span className={cn('badge', 'status-' + b.status)} style={{ fontWeight: 700, padding: '4px 12px' }}>{b.status}</span>
          <div className="text-2xl font-bold mt-2" style={{ color: 'var(--brand-primary)' }}>{formatNzd(b.price_nzd)}</div>
          <div className="text-xs font-medium mt-0.5" style={{ color: payment.color }}>{payment.label}</div>
        </div>`;
const replacement2 = `        <div className="flex items-center justify-between sm:block sm:text-right shrink-0 pl-15 sm:pl-0" style={{ paddingLeft: 60 }}>
          <span className={cn('badge', 'status-' + b.status)} style={{ fontWeight: 700, padding: '4px 12px' }}>{b.status}</span>
          <div className="text-2xl font-bold sm:mt-2" style={{ color: 'var(--brand-primary)' }}>{formatNzd(b.price_nzd)}</div>
          <div className="text-xs font-medium sm:mt-0.5" style={{ color: payment.color }}>{payment.label}</div>
        </div>`;

console.log('Target 2 found:', c.includes(target2));
c = c.replace(target2, replacement2);

// Fix 3: JoinedGameRow header - same stacking fix
const target3 = `      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-12 h-12 rounded-lg flex items-center justify-center text-xl shrink-0" style={{ background: 'var(--brand-accent-muted)' }}>
            🙋
          </div>`;
const replacement3 = `      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-2">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-12 h-12 rounded-lg flex items-center justify-center text-xl shrink-0" style={{ background: 'var(--brand-accent-muted)' }}>
            🙋
          </div>`;

console.log('Target 3 found:', c.includes(target3));
c = c.replace(target3, replacement3);

// Fix 4: JoinedGameRow price block - horizontal on mobile too
const target4 = `        <div className="text-right shrink-0">
          <div className="text-xs font-semibold px-2 py-1 rounded-lg" style={{ background: 'var(--brand-primary-muted)', color: 'var(--brand-primary)' }}>Paid ✓</div>
          <div className="text-lg font-bold mt-2" style={{ color: 'var(--brand-primary)' }}>{formatNzd(j.amount_nzd)}</div>
        </div>`;
const replacement4 = `        <div className="flex items-center justify-between sm:block sm:text-right shrink-0" style={{ paddingLeft: 60 }}>
          <div className="text-xs font-semibold px-2 py-1 rounded-lg" style={{ background: 'var(--brand-primary-muted)', color: 'var(--brand-primary)' }}>Paid ✓</div>
          <div className="text-lg font-bold sm:mt-2" style={{ color: 'var(--brand-primary)' }}>{formatNzd(j.amount_nzd)}</div>
        </div>`;

console.log('Target 4 found:', c.includes(target4));
c = c.replace(target4, replacement4);

fs.writeFileSync(path, c, 'utf8');

console.log('BookingRow header responsive:', c.includes('flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-3'));
console.log('BookingRow price block responsive:', c.includes("className=\"flex items-center justify-between sm:block sm:text-right shrink-0 pl-15 sm:pl-0\""));
console.log('JoinedGameRow header responsive:', c.includes('flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-2'));

const openTags = (c.match(/<a\b/g) || []).length;
const closeTags = (c.match(/<\/a>/g) || []).length;
console.log('Anchor tags balanced:', openTags === closeTags, `(${openTags} open, ${closeTags} close)`);
