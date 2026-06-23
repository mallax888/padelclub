'use client'

import { useState } from 'react'
import { VENUES, type Venue } from '@/lib/venues'

const REGIONS = [
  { name: 'Auckland',     island: 'New Zealand' },
  { name: 'Wellington',   island: 'New Zealand' },
  { name: 'Christchurch', island: 'New Zealand' },
  { name: 'Nelspruit',    island: 'South Africa' },
]

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
      {/* Region buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {REGIONS.map(region => {
          const isActive = activeRegion === region.name
          const venues = VENUES.filter(v => v.region === region.name)
          const courts = venues.reduce((sum, v) => sum + v.courts.length, 0)
          const hasLive = venues.some(v => v.isLive)
          return (
            <button
              key={region.name}
              onClick={() => {
                setActiveRegion(region.name)
                const first = venues.find(v => v.isLive) ?? venues[0]
                if (first) onChange(first)
              }}
              className="rounded-xl p-4 text-left transition-all"
              style={{
                background: isActive ? 'var(--brand-primary)' : 'var(--bg-surface)',
                border: `1px solid ${isActive ? 'var(--brand-primary)' : 'var(--border)'}`,
                boxShadow: isActive ? 'var(--glow-primary)' : 'none',
              }}
            >
              <div className="flex items-start justify-between mb-2">
                <span style={{ fontSize: 18, color: isActive ? 'var(--brand-primary-on)' : 'var(--brand-primary)' }}>⊙</span>
                {!hasLive && (
                  <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full"
                    style={{
                      background: isActive ? 'rgba(0,0,0,0.15)' : 'var(--brand-accent-muted)',
                      color: isActive ? 'var(--brand-primary-on)' : 'var(--brand-accent)',
                    }}>
                    Soon
                  </span>
                )}
              </div>
              <div className="text-base font-semibold mb-1"
                style={{ color: isActive ? 'var(--brand-primary-on)' : 'var(--text-primary)' }}>
                {region.name}
              </div>
              <div className="text-[10px] mb-2"
                style={{ color: isActive ? 'var(--brand-primary-on)' : 'var(--text-subtle)', opacity: 0.8 }}>
                {region.island}
              </div>
              <div className="flex gap-1.5 flex-wrap">
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                  style={{
                    background: isActive ? 'rgba(0,0,0,0.15)' : 'var(--bg-raised)',
                    color: isActive ? 'var(--brand-primary-on)' : 'var(--text-muted)',
                  }}>
                  {venues.length} venue{venues.length > 1 ? 's' : ''}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                  style={{
                    background: isActive ? 'rgba(0,0,0,0.15)' : 'var(--bg-raised)',
                    color: isActive ? 'var(--brand-primary-on)' : 'var(--text-muted)',
                  }}>
                  {courts} courts
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Sub-venue cards */}
      {regionVenues.length > 1 && (
        <div className="grid grid-cols-2 gap-2 mb-1">
          {regionVenues.map(venue => {
            const isSelected = selected.slug === venue.slug
            return (
              <button
                key={venue.slug}
                onClick={() => onChange(venue)}
                className="rounded-lg px-3 py-2.5 text-left transition-all"
                style={{
                  background: isSelected ? 'var(--brand-primary-muted)' : 'var(--bg-raised)',
                  border: `1px solid ${isSelected ? 'var(--brand-primary)' : 'var(--border)'}`,
                }}
              >
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="text-xs font-medium truncate"
                    style={{ color: isSelected ? 'var(--brand-primary)' : 'var(--text-primary)' }}>
                    {venue.name}
                  </span>
                  {!venue.isLive && (
                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full shrink-0"
                      style={{ background: 'var(--brand-accent-muted)', color: 'var(--brand-accent)' }}>
                      Soon
                    </span>
                  )}
                </div>
                <div className="text-[10px] truncate" style={{ color: 'var(--text-subtle)' }}>
                  {venue.courts.length} courts · {venue.address.split(',')[0]}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
