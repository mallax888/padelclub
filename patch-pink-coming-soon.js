const fs = require('fs');
let c = fs.readFileSync('components/booking/BookingFlow.tsx', 'utf8');

if (!c.includes('New country')) {
  c = c.replace(
    /(\{COUNTRIES\.map\(c => \([\s\S]*?\)\)\})/,
    `$1
            <div className="rounded-xl p-5 flex flex-col items-center gap-3 opacity-80"
              style={{ background: 'var(--bg-surface)', border: '1px dashed var(--brand-accent)', minHeight: 180, position: 'relative', cursor: 'default' }}>
              <div style={{ fontSize: 36 }}>🌍</div>
              <div className="text-lg font-bold text-center" style={{ color: 'var(--text-muted)' }}>New country</div>
              <div className="text-xs text-center px-2 py-1 rounded-full font-semibold" style={{ background: 'var(--brand-accent-muted)', color: 'var(--brand-accent)' }}>Coming soon</div>
              <div className="text-xs text-center" style={{ color: 'var(--text-subtle)' }}>UK · USA · UAE — vote for yours</div>
            </div>`
  );
}

fs.writeFileSync('components/booking/BookingFlow.tsx', c, 'utf8');
console.log('Done - has new country:', c.includes('New country'));
