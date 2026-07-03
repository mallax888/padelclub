const fs = require('fs');
const path = 'components/booking/MyBookingsList.tsx';
let c = fs.readFileSync(path, 'utf8');

const target = `      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-medium" style={{ color: 'var(--text-primary)' }}>Upcoming</h2>
          <Link href="/book" className="btn btn-primary btn-sm">+ New booking</Link>
        </div>`;

const replacement = `      <Link href="/book" className="flex items-center justify-between rounded-xl p-5 mb-6 transition-all hover:scale-[1.01]"
        style={{ background: 'var(--brand-primary)', boxShadow: 'var(--glow-primary)' }}>
        <div>
          <div className="text-lg font-bold" style={{ color: 'var(--brand-primary-on)' }}>+ New booking</div>
          <div className="text-sm font-medium opacity-80" style={{ color: 'var(--brand-primary-on)' }}>Book a court in seconds</div>
        </div>
        <div style={{ fontSize: 28, color: 'var(--brand-primary-on)' }}>🎾</div>
      </Link>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-medium" style={{ color: 'var(--text-primary)' }}>Upcoming</h2>
        </div>`;

console.log('Target found:', c.includes(target));
c = c.replace(target, replacement);
fs.writeFileSync(path, c, 'utf8');
console.log('Big CTA added:', c.includes('Book a court in seconds'));
console.log('Old small button removed:', !c.includes('className="btn btn-primary btn-sm">+ New booking</Link>'));
