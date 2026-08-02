'use client'

import { useEffect, useRef, useState } from 'react'
import { SPECIALS, DAY_NAMES } from '@/lib/specials'
import { VENUES } from '@/lib/venues'

export default function SpecialsMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  if (SPECIALS.length === 0) return null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`nav-tab flex items-center gap-1 ${open ? 'nav-tab-active' : ''}`}
      >
        🍗 Specials
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-80 rounded-xl p-2 z-50"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
          {SPECIALS.map(s => {
            const venue = VENUES.find(v => v.slug === s.venueSlug)
            return (
              <div key={s.id} className="rounded-lg p-3" style={{ background: 'var(--bg-raised)' }}>
                <div className="text-sm font-semibold" style={{ color: 'var(--brand-primary)' }}>
                  {s.title}
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-primary)' }}>
                  {s.dayOfWeek !== undefined ? `${DAY_NAMES[s.dayOfWeek]}s` : 'Every day'} at {s.partnerName}
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {s.blurb}
                </div>
                {s.howToRedeem && (
                  <div className="text-[11px] mt-1.5 font-medium" style={{ color: 'var(--brand-primary)' }}>
                    {s.howToRedeem}
                  </div>
                )}
                {(s.address || venue) && (
                  <div className="text-[11px] mt-2" style={{ color: 'var(--text-subtle)' }}>
                    {s.address}{venue ? ` · near ${venue.name}` : ''}
                  </div>
                )}
                {s.website && (
                  <a href={s.website} target="_blank" rel="noopener noreferrer"
                    className="text-[11px] font-medium mt-1 inline-block"
                    style={{ color: 'var(--brand-primary)' }}
                    onClick={e => e.stopPropagation()}>
                    Visit website →
                  </a>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
