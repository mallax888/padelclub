'use client'

import { VENUES, type Venue } from '@/lib/venues'

const REGIONS = ['Auckland', 'Wellington', 'Christchurch']

export default function VenueSwitcher({
  selected,
  onChange,
}: {
  selected: Venue
  onChange: (venue: Venue) => void
}) {
  return (
    <div className="mb-5">
      <h2 className="text-xs font-medium uppercase tracking-wide mb-3"
        style={{ color: 'var(--text-muted)' }}>
        Choose a venue
      </h2>
      <div className="space-y-4">
        {REGIONS.map(region => {
          const regionVenues = VENUES.filter(v => v.region === region)
          return (
            <div key={region}>
              <div className="text-xs font-medium uppercase tracking-wide mb-2"
                style={{ color: 'var(--text-subtle)' }}>
                {region}
              </div>
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(regionVenues.length, 2)}, 1fr)` }}>
                {regionVenues.map(venue => {
                  const isSelected = selected.slug === venue.slug
                  return (
                    <button
                      key={venue.slug}
                      onClick={() => onChange(venue)}
                      className="rounded-lg px-3 py-2.5 text-left transition-all"
                      style={{
                        background: isSelected ? 'var(--brand-primary)' : 'var(--bg-surface)',
                        border: `1px solid ${isSelected ? 'var(--brand-primary)' : 'var(--border)'}`,
                        boxShadow: isSelected ? 'var(--glow-primary)' : 'none',
                      }}
                    >
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="text-sm font-medium truncate"
                          style={{ color: isSelected ? 'var(--brand-primary-on)' : 'var(--text-primary)' }}>
                          {venue.name}
                        </span>
                        {!venue.isLive && (
                          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full shrink-0"
                            style={{
                              background: isSelected ? 'rgba(0,0,0,0.15)' : 'var(--brand-accent-muted)',
                              color: isSelected ? 'var(--brand-primary-on)' : 'var(--brand-accent)',
                            }}>
                            Soon
                          </span>
                        )}
                      </div>
                      <div className="text-xs truncate"
                        style={{ color: isSelected ? 'var(--brand-primary-on)' : 'var(--text-subtle)', opacity: isSelected ? 0.8 : 1 }}>
                        {venue.courts.length} court{venue.courts.length > 1 ? 's' : ''} · {venue.address.split(',')[0]}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
