'use client'

import { type Venue } from '@/lib/venues'

const ICON_MAP: Record<string, string> = {
  'ti-parking': 'P',
  'ti-coffee': '☕',
  'ti-shirt': '👕',
  'ti-shopping-bag': '🛍️',
  'ti-bulb': '💡',
  'ti-tools': '🔧',
  'ti-baby-carriage': '🧸',
}

export default function VenueLayout({ venue }: { venue: Venue }) {
  return (
    <div className="rounded-xl p-4 mb-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {venue.name}
          </div>
          <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>
            {venue.address} · {venue.courts.length} court{venue.courts.length > 1 ? 's' : ''}
          </div>
        </div>
        {!venue.isLive && (
          <span
            className="text-[10px] font-medium px-2 py-1 rounded-full"
            style={{ background: 'var(--brand-accent-muted)', color: 'var(--brand-accent)' }}
          >
            Coming soon — preview
          </span>
        )}
      </div>

      {/* Court image grid — badge above each image */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        {venue.courts.map(court => (
          <div key={court.id} className="flex flex-col items-center gap-2">
            <span
              className="text-xs font-medium px-3 py-1 rounded-full"
              style={{ background: 'var(--brand-primary-muted)', color: 'var(--brand-primary)' }}
            >
              {court.name}
            </span>
            <div className="w-full rounded-lg overflow-hidden"
              style={{ border: '1px solid var(--border)', background: '#e8e8e8' }}>
              <img
                src="/courts/court-plan.png"
                alt={`${court.name} — ${court.type}`}
                className="w-full h-auto block"
                style={{ aspectRatio: '898 / 562', objectFit: 'cover' }}
              />
            </div>
            <div className="text-[10px] text-center" style={{ color: 'var(--text-subtle)' }}>
              {court.type} · {court.isIndoor ? 'Indoor' : 'Outdoor'}
            </div>
          </div>
        ))}
      </div>

      {/* Amenities */}
      <div className="flex flex-wrap gap-2">
        {venue.amenities.map(a => (
          <div
            key={a.label}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
            style={{ background: 'var(--bg-raised)', color: 'var(--text-muted)' }}
          >
            <span>{ICON_MAP[a.icon] ?? '•'}</span>
            <span>{a.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
