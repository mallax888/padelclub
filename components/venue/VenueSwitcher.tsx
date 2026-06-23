'use client'

import { useState } from 'react'
import { VENUES, type Venue } from '@/lib/venues'

const REGIONS = ['Auckland', 'Wellington', 'Christchurch']

export default function VenueSwitcher({
  selected,
  onChange,
}: {
  selected: Venue
  onChange: (venue: Venue) => void
}) {
  const [activeRegion, setActiveRegion] = useState(selected.region)
  const regionVenues = VENUES.filter(v => v.region === activeRegion)

  return (
    <div className="mb-5">
      {/* Region tabs */}
      <div className="flex gap-1 mb-3" style={{ borderBottom: '1px solid var(--border)' }}>
        {REGIONS.map(region => {
          const isActive = activeRegion === region
          return (
            <button
              key={region}
              onClick={() => {
                setActiveRegion(region)
                const first = VENUES.find(v => v.region === region)
                if (first) onChange(first)
              }}
              className="px-4 py-2 text-sm transition-colors"
              style={{
                borderBottom: `2px solid ${isActive ? 'var(--brand-primary)' : 'transparent'}`,
                color: isActive ? 'var(--brand-primary)' : 'var(--text-muted)',
                fontWeight: isActive ? 500 : 400,
                marginBottom: -1,
              }}
            >
              {region}
            </button>
          )
        })}
      </div>

      {/* Venue cards for selected region */}
      <div className="grid grid-cols-2 gap-2">
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
}
