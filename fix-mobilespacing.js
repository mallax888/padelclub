const fs = require('fs');
const path = 'components/booking/MyBookingsList.tsx';
let c = fs.readFileSync(path, 'utf8');

const target = `        <div className="flex items-center justify-between sm:block sm:text-right shrink-0 pl-15 sm:pl-0" style={{ paddingLeft: 60 }}>
          <span className={cn('badge', 'status-' + b.status)} style={{ fontWeight: 700, padding: '4px 12px' }}>{b.status}</span>
          <div className="text-2xl font-bold sm:mt-2" style={{ color: 'var(--brand-primary)' }}>{formatNzd(b.price_nzd)}</div>
          <div className="text-xs font-medium sm:mt-0.5" style={{ color: payment.color }}>{payment.label}</div>
        </div>`;

const replacement = `        <div className="flex items-center gap-3 sm:block sm:text-right shrink-0">
          <span className={cn('badge', 'status-' + b.status)} style={{ fontWeight: 700, padding: '4px 12px' }}>{b.status}</span>
          <div className="flex items-baseline gap-2 sm:block">
            <div className="text-2xl font-bold sm:mt-2" style={{ color: 'var(--brand-primary)' }}>{formatNzd(b.price_nzd)}</div>
            <div className="text-xs font-medium whitespace-nowrap sm:mt-0.5" style={{ color: payment.color }}>{payment.label}</div>
          </div>
        </div>`;

console.log('Target found:', c.includes(target));
c = c.replace(target, replacement);
fs.writeFileSync(path, c, 'utf8');
console.log('Spacing fixed:', c.includes('flex items-center gap-3 sm:block sm:text-right shrink-0'));
console.log('No-wrap on payment label:', c.includes('text-xs font-medium whitespace-nowrap'));
