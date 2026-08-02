'use client'

import { useEffect, useRef, useState } from 'react'
import { SPECIALS, cadencePill } from '@/lib/specials'
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
        Specials
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-80 rounded-xl p-2 z-50 space-y-2"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
          {SPECIALS.map(s => {
            const venue = VENUES.find(v => v.slug === s.venueSlug)
            const pill = cadencePill(s)
            return (
              <div key={s.id} className="rounded-lg p-3 flex gap-3" style={{ background: 'var(--bg-raised)' }}>
                {s.stat && (
                  <div className="shrink-0 w-14 h-14 rounded-[10px] flex flex-col items-center justify-center leading-none"
                    style={{
                      background: 'linear-gradient(155deg, var(--brand-primary-muted), transparent 70%)',
                      border: '1px solid var(--brand-primary)',
                    }}>
                    <div className="text-lg font-extrabold" style={{ color: 'var(--brand-primary)', fontVariantNumeric: 'tabular-nums' }}>
                      {s.stat.value}
                    </div>
                    <div className="text-[8px] font-bold mt-0.5" style={{ color: 'var(--brand-primary)', letterSpacing: '0.03em' }}>
                      {s.stat.unit}
                    </div>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    {s.title}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    at {s.partnerName}
                  </div>
                  <div className="inline-flex items-center gap-1 mt-1.5 text-[9.5px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: 'var(--brand-accent-muted)', color: 'var(--brand-accent)', letterSpacing: '0.02em' }}>
                    {pill.live && <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--brand-accent)' }} />}
                    {pill.text.toUpperCase()}
                  </div>
                  {s.howToRedeem && (
                    <div className="text-[11px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
                      {s.howToRedeem}
                    </div>
                  )}
                  {(s.address || venue) && (
                    <div className="text-[10.5px] mt-1" style={{ color: 'var(--text-subtle)' }}>
                      {s.address}{venue ? ` · near ${venue.name}` : ''}
                    </div>
                  )}
                  {s.website && (
                    <a href={s.website} target="_blank" rel="noopener noreferrer"
                      className="text-[10.5px] font-medium mt-1 inline-block"
                      style={{ color: 'var(--brand-primary)' }}
                      onClick={e => e.stopPropagation()}>
                      Visit website →
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
