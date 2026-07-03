const fs = require('fs');
const path = 'components/booking/MyBookingsList.tsx';
let c = fs.readFileSync(path, 'utf8');

const target1 = "const payment = paymentLabel(b.payment_method, b.stripe_payment_id)";
const replacement1 = "const payment = paymentLabel(b.payment_method, b.stripe_payment_id)\n  const venue = VENUES.find(v => v.slug === (b.courts as any)?.venue_slug)";

const target2 = "              {b.courts?.name} — {b.courts?.type}\n            </div>\n            <div className=\"text-xs mt-0.5\" style={{ color: 'var(--text-muted)' }}>\n              {formatDate(b.date)} · {b.start_time.slice(0,5)}–{b.end_time.slice(0,5)} · {durationLabel(b.duration_minutes)}\n            </div>";
const replacement2 = "              {b.courts?.name} — {b.courts?.type}\n            </div>\n            {venue && (\n              <div className=\"text-xs font-semibold mt-0.5\" style={{ color: 'var(--brand-primary)' }}>\n                📍 {venue.name}\n              </div>\n            )}\n            <div className=\"text-xs mt-0.5\" style={{ color: 'var(--text-muted)' }}>\n              {formatDate(b.date)} · {b.start_time.slice(0,5)}–{b.end_time.slice(0,5)} · {durationLabel(b.duration_minutes)}\n            </div>";

const target3 = "{!past && (() => {\n              const venue = VENUES.find(v => v.slug === (b.courts as any)?.venue_slug)\n              if (!venue) return null\n              return (\n                <a\n                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.address)}`}\n                  target=\"_blank\"\n                  rel=\"noopener noreferrer\"\n                  className=\"inline-flex items-center gap-1 text-xs font-medium mt-1\"\n                  style={{ color: 'var(--brand-primary)' }}\n                  onClick={e => e.stopPropagation()}\n                >\n                  📍 Directions\n                </a>\n              )\n            })()}";
const replacement3 = "{!past && venue && (\n              <a\n                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.address)}`}\n                target=\"_blank\"\n                rel=\"noopener noreferrer\"\n                className=\"inline-flex items-center gap-1 text-xs font-medium mt-1\"\n                style={{ color: 'var(--brand-primary)' }}\n                onClick={e => e.stopPropagation()}\n              >\n                Get directions ↗\n              </a>\n            )}";

console.log('Target 1 found:', c.includes(target1));
console.log('Target 2 found:', c.includes(target2));
console.log('Target 3 found:', c.includes(target3));

c = c.replace(target1, replacement1);
c = c.replace(target2, replacement2);
c = c.replace(target3, replacement3);

fs.writeFileSync(path, c, 'utf8');
console.log('Shared venue var added:', c.includes('const venue = VENUES.find'));
console.log('Venue name in header:', c.includes('📍 {venue.name}'));
console.log('Directions simplified:', c.includes('Get directions ↗'));
