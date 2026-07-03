const fs = require('fs');
const path = 'components/booking/MyBookingsList.tsx';
let c = fs.readFileSync(path, 'utf8');

const target1 = `import Link from 'next/link'`;
const replacement1 = `import Link from 'next/link'
import { VENUES } from '@/lib/venues'`;

const target2 = `{formatDate(b.date)} · {b.start_time.slice(0,5)}–{b.end_time.slice(0,5)} · {durationLabel(b.duration_minutes)}
            </div>
          </div>
        </div>`;
const replacement2 = `{formatDate(b.date)} · {b.start_time.slice(0,5)}–{b.end_time.slice(0,5)} · {durationLabel(b.duration_minutes)}
            </div>
            {!past && (() => {
              const venue = VENUES.find(v => v.slug === (b.courts as any)?.venue_slug)
              if (!venue) return null
              return (
                
                  href={\`https://www.google.com/maps/search/?api=1&query=\${encodeURIComponent(venue.address)}\`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium mt-1"
                  style={{ color: 'var(--brand-primary)' }}
                  onClick={e => e.stopPropagation()}
                >
                  📍 Directions
                </a>
              )
            })()}
          </div>
        </div>`;

console.log('Target 1 found:', c.includes(target1));
console.log('Target 2 found:', c.includes(target2));

c = c.replace(target1, replacement1);
c = c.replace(target2, replacement2);

fs.writeFileSync(path, c, 'utf8');
console.log('VENUES import added:', c.includes("import { VENUES } from '@/lib/venues'"));
console.log('Directions link added:', c.includes('📍 Directions'));
