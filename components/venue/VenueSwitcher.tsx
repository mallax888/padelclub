'use client'

import { useState, useRef, useEffect } from 'react'
import { VENUES, type Venue } from '@/lib/venues'

const REGIONS = VENUES.map(v => v.region).filter((r, i, arr) => arr.indexOf(r) === i)

export default function VenueSwitcher({
  selected,
  onChange,
}: {
  selected: Venue
  onChange: (venue: Venue) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [activeRegion, setActiveRegion] = useState(selected.region)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const filtered = VENUES.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.region.toLowerCase().includes(search.toLowerCase()) ||
    v.address.toLowerCase().includes(search.toLowerCase())
  )

  const grouped = REGIONS.reduce((acc, region) => {
    const venues = filtered.filter(v => v.region === region)
    if (venues.length) acc[region] = venues
    return acc
  }, {} as Record<string, Venue[]>)

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (venue: Venue) => {
    onChange(venue)
    setOpen(false)
    setSearch('')
    setActiveRegion(venue.region)
  }

  const regionVenues = VENUES.filter(v => v.region === activeRegion)

  return (
    <div className="mb-5">
      <h2 className="text-xs font-medium uppercase tracking-wide mb-3"
        style={{ color: 'var(--text-muted)' }}>
        Choose a venue
      </h2>

      {/* ── DESKTOP: Command palette ─────────────────── */}
      <div className="hidden md:block" ref={dropdownRef}>
        <button
          onClick={() => setOpen(!open)}
          className="w-full rounded-xl px-4 py-3 text-left transition-all flex items-center gap-3"
          style={{
            background: 'var(--bg-surface)',
            border: `1px solid ${open ? 'var(--brand-primary)' : 'var(--border)'}`,
            boxShadow: open ? 'var(--glow-primary)' : 'none',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--brand-primary)', flexShrink: 0 }}>
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
              {selected.name}
            </div>
            <div className="text-xs truncate" style={{ color: 'var(--text-subtle)' }}>
              {selected.address} · {selected.courts.length} courts
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <kbd className="text-[10px] px-1.5 py-0.5 rounded font-mono"
              style={{ background: 'var(--bg-raised)', color: 'var(--text-subtle)', border: '1px solid var(--border)' }}>
              ⌘K
            </kbd>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-subtle)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
        </button>

        {open && (
          <div className="absolute z-50 mt-2 rounded-xl overflow-hidden shadow-xl"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--brand-primary)',
              boxShadow: 'var(--glow-primary)',
              width: '100%',
              maxWidth: 520,
            }}>
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3"
              style={{ borderBottom: '1px solid var(--border)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-subtle)', flexShrink: 0 }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                ref={inputRef}
                type="text"
                placeholder="Search venues, cities..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: 'var(--text-primary)' }}
              />
              <kbd className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                style={{ background: 'var(--bg-raised)', color: 'var(--text-subtle)', border: '1px solid var(--border)' }}>
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {Object.keys(grouped).length === 0 ? (
                <div className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-subtle)' }}>
                  No venues found
                </div>
              ) : (
                Object.entries(grouped).map(([region, venues]) => (
                  <div key={region}>
                    <div className="px-4 py-2 text-[10px] font-medium uppercase tracking-widest"
                      style={{ color: 'var(--text-subtle)', background: 'var(--bg-raised)' }}>
                      {region}
                    </div>
                    {venues.map(venue => (
                      <button
                        key={venue.slug}
                        onClick={() => handleSelect(venue)}
                        className="w-full px-4 py-3 text-left flex items-center gap-3 transition-colors"
                        style={{
                          borderLeft: venue.slug === selected.slug ? '2px solid var(--brand-primary)' : '2px solid transparent',
                          background: venue.slug === selected.slug ? 'var(--brand-primary-muted)' : 'transparent',
                        }}
                        onMouseEnter={e => {
                          if (venue.slug !== selected.slug)
                            (e.currentTarget as HTMLElement).style.background = 'var(--bg-raised)'
                        }}
                        onMouseLeave={e => {
                          if (venue.slug !== selected.slug)
                            (e.currentTarget as HTMLElement).style.background = 'transparent'
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate"
                            style={{ color: venue.slug === selected.slug ? 'var(--brand-primary)' : 'var(--text-primary)' }}>
                            {venue.name}
                          </div>
                          <div className="text-xs truncate" style={{ color: 'var(--text-subtle)' }}>
                            {venue.address.split(',').slice(0, 2).join(',')}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                            style={{
                              background: venue.isLive ? 'var(--brand-primary-muted)' : 'var(--brand-accent-muted)',
                              color: venue.isLive ? 'var(--brand-primary)' : 'var(--brand-accent)',
                            }}>
                            {venue.isLive ? 'Live' : 'Soon'}
                          </span>
                          <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                            {venue.courts.length} courts
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>

            <div className="px-4 py-2 flex items-center gap-4 text-[10px]"
              style={{ borderTop: '1px solid var(--border)', color: 'var(--text-subtle)', background: 'var(--bg-raised)' }}>
              <span>↑↓ navigate</span>
              <span>↵ select</span>
              <span>ESC close</span>
            </div>
          </div>
        )}
      </div>

      {/* ── MOBILE: Floating pills + list ────────────── */}
      <div className="md:hidden">
        <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
          {REGIONS.map(region => {
            const isActive = activeRegion === region
            const courts = VENUES.filter(v => v.region === region).reduce((s, v) => s + v.courts.length, 0)
            return (
              <button
                key={region}
                onClick={() => {
                  setActiveRegion(region)
                  const first = VENUES.find(v => v.region === region && v.isLive) ?? VENUES.find(v => v.region === region)
                  if (first) onChange(first)
                }}
                className="shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all"
                style={{
                  background: isActive ? 'var(--brand-primary)' : 'var(--bg-surface)',
                  color: isActive ? 'var(--brand-primary-on)' : 'var(--text-muted)',
                  border: `1px solid ${isActive ? 'var(--brand-primary)' : 'var(--border)'}`,
                  boxShadow: isActive ? 'var(--glow-primary)' : 'none',
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                {region}
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                  style={{ background: isActive ? 'rgba(0,0,0,0.2)' : 'var(--bg-raised)', color: isActive ? 'var(--brand-primary-on)' : 'var(--text-subtle)' }}>
                  {courts}
                </span>
              </button>
            )
          })}
        </div>

        <div className="rounded-xl overflow-hidden"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          {regionVenues.map((venue, i) => (
            <button
              key={venue.slug}
              onClick={() => handleSelect(venue)}
              className="w-full px-4 py-3 text-left flex items-center gap-3 transition-colors"
              style={{
                borderBottom: i < regionVenues.length - 1 ? '1px solid var(--border)' : 'none',
                borderLeft: venue.slug === selected.slug ? '3px solid var(--brand-primary)' : '3px solid transparent',
                background: venue.slug === selected.slug ? 'var(--brand-primary-muted)' : 'transparent',
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate"
                  style={{ color: venue.slug === selected.slug ? 'var(--brand-primary)' : 'var(--text-primary)' }}>
                  {venue.name}
                </div>
                <div className="text-xs truncate" style={{ color: 'var(--text-subtle)' }}>
                  {venue.address.split(',')[0]} · {venue.courts.length} courts
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0"
                style={{
                  background: venue.isLive ? 'var(--brand-primary-muted)' : 'var(--brand-accent-muted)',
                  color: venue.isLive ? 'var(--brand-primary)' : 'var(--brand-accent)',
                }}>
                {venue.isLive ? 'Live' : 'Soon'}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

