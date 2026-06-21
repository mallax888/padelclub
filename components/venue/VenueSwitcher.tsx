'use client'

import { VENUES, type Venue } from '@/lib/venues'

export default function VenueSwitcher({
  selected,
  onChange,
}: {
  selected: Venue
  onChange: (venue: Venue) => void
}) {
  return (
    <div className="mb-5">
      <h2 className="text-xs font-medium uppercase tracking-wide mb-2"
        style={{ color: 'var(--text-muted)' }}>
        Choose a venue
      </h2>
      <div className="grid grid-cols-3 gap-3">
        {VENUES.map(venue => {
          const isSelected = selected.slug === venue.slug
          return (
            <button
              key={venue.slug}
              onClick={() => onChange(venue)}
              className="rounded-lg px-4 py-3 text-left transition-all"
              style={{
                background: isSelected ? 'var(--brand-primary)' : 'var(--bg-surface)',
                border: `1px solid ${isSelected ? 'var(--brand-primary)' : 'var(--border)'}`,
                boxShadow: isSelected ? 'var(--glow-primary)' : 'none',
              }}
            >
              <div className="flex items-center justify-between gap-2 mb-1" style={{ minHeight: 20 }}>
                <span
                  className="text-sm font-medium truncate"
                  style={{ color: isSelected ? 'var(--brand-primary-on)' : 'var(--text-primary)' }}
                >
                  {venue.region}
                </span>
                {!venue.isLive && (
                  <span
                    className="text-[9px] font-medium px-1.5 py-0.5 rounded-full shrink-0"
                    style={{
                      background: isSelected ? 'rgba(0,0,0,0.15)' : 'var(--brand-accent-muted)',
                      color: isSelected ? 'var(--brand-primary-on)' : 'var(--brand-accent)',
                    }}
                  >
                    Soon
                  </span>
                )}
              </div>
              <div
                className="text-xs"
                style={{ color: isSelected ? 'var(--brand-primary-on)' : 'var(--text-subtle)', opacity: isSelected ? 0.8 : 1 }}
              >
                {venue.courts.length} courts
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
