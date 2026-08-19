'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { SPECIALS, cadencePill } from '@/lib/specials'
import { VENUES } from '@/lib/venues'

export default function SpecialsMenu() {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (ref.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  // The sidebar is a vertical-scroll container, which per the CSS spec forces
  // it to clip horizontally too — an inline flyout panel would get cut off and
  // scrollable instead of floating over the page. Portal it to <body> and
  // position it with fixed coordinates (anchored past the sidebar's right
  // edge) so it escapes that clipping entirely.
  useLayoutEffect(() => {
    if (!open || !ref.current) {
      setCoords(null)
      return
    }
    const buttonRect = ref.current.getBoundingClientRect()
    const asideRect = ref.current.closest('aside')?.getBoundingClientRect()
    setCoords({
      left: (asideRect?.right ?? buttonRect.right) + 8,
      top: buttonRect.top,
    })
  }, [open])

  if (SPECIALS.length === 0) return null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] font-semibold whitespace-nowrap transition-colors cursor-pointer select-none"
        style={{ color: 'var(--brand-accent)', background: open ? 'var(--brand-accent-muted)' : 'transparent' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--brand-accent-muted)')}
        onMouseLeave={e => (e.currentTarget.style.background = open ? 'var(--brand-accent-muted)' : 'transparent')}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M20 12v9H4v-9M2 7h20v5H2zM12 22V7M12 7c-2-4-8-4-8 0s6 0 8 0zM12 7c2-4 8-4 8 0s-6 0-8 0z"/>
        </svg>
        Specials
      </button>

      {open && coords && createPortal(
        <div ref={panelRef} className="fixed w-80 rounded-xl p-2 z-50 space-y-2"
          style={{ left: coords.left, top: coords.top, background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
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
                    <div className="text-lg font-extrabold" style={{ color: 'var(--brand-primary-text)', fontVariantNumeric: 'tabular-nums' }}>
                      {s.stat.value}
                    </div>
                    <div className="text-[8px] font-bold mt-0.5" style={{ color: 'var(--brand-primary-text)', letterSpacing: '0.03em' }}>
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
                      style={{ color: 'var(--brand-primary-text)' }}
                      onClick={e => e.stopPropagation()}>
                      Visit website →
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>,
        document.body,
      )}
    </div>
  )
}
