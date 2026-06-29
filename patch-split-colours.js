const fs = require('fs');
let c = fs.readFileSync('components/booking/BookingFlow.tsx', 'utf8');

// Fix split toggle - should be brand-primary not crimson
c = c.replace(
  "splitEnabled ? 'var(--brand-crimson)' : 'var(--bg-raised)'",
  "splitEnabled ? 'var(--brand-primary)' : 'var(--bg-raised)'"
);

// Fix selected player border
c = c.replace(
  "selected ? 'var(--brand-crimson-muted)' : 'var(--bg-raised)'",
  "selected ? 'var(--brand-primary-muted)' : 'var(--bg-raised)'"
);
c = c.replace(
  "selected ? '1px solid var(--brand-crimson)' : '1px solid var(--border)'",
  "selected ? '1px solid var(--brand-primary)' : '1px solid var(--border)'"
);

// Fix selected player text colour
c = c.replace(
  "selected ? 'var(--brand-crimson)' : 'var(--text-primary)'",
  "selected ? 'var(--brand-primary)' : 'var(--text-primary)'"
);

// Fix each amount text colour
c = c.replace(
  "color: 'var(--brand-crimson)' }}>{formatNzd(courtPrice",
  "color: 'var(--brand-primary)' }}>{formatNzd(courtPrice"
);

fs.writeFileSync('components/booking/BookingFlow.tsx', c, 'utf8');
console.log('Done');
