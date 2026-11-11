'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { homePathFor, rememberViewMode, type ViewMode } from '@/lib/view-mode'

const display = { fontFamily: 'var(--font-display), Manrope, sans-serif' } as const

// "View the app as Manager or Player". Only ever rendered for staff and admins,
// who are the only people with more than one side to switch between. The
// choice is remembered (cookie) so the next visit opens on the same side.
export default function ViewSwitch({ mode, variant = 'pill', onNavigate }: {
  mode: ViewMode
  variant?: 'pill' | 'row'
  onNavigate?: () => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const choose = (next: ViewMode) => {
    setOpen(false)
    onNavigate?.()
    if (next === mode) return
    rememberViewMode(next)
    router.push(homePathFor(next))
    router.refresh()
  }

  const label = mode === 'manager' ? 'Manager' : 'Player'

  return (
    <>
      {variant === 'pill' ? (
        <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog"
          className="inline-flex items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-extrabold shrink-0"
          style={{ minHeight: 40, background: 'var(--brand-primary-muted)', border: '1px solid var(--brand-primary)', color: 'var(--brand-primary-text)' }}>
          <span aria-hidden>⇄</span> {label}
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog"
          className="flex items-center justify-between w-full px-3 py-3 rounded-lg text-base"
          style={{ color: 'var(--text-primary)', background: 'var(--bg-raised)' }}>
          <span>View as <b style={{ color: 'var(--brand-primary-text)' }}>{label}</b></span>
          <span aria-hidden style={{ color: 'var(--text-subtle)' }}>⇄</span>
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center" role="dialog" aria-modal="true" aria-label="View the app as">
          <div className="absolute inset-0" style={{ background: 'rgba(10,12,15,0.55)' }} onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-md rounded-t-[26px] md:rounded-[26px] px-4 pt-3.5"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>
            <div className="mx-auto mb-3.5 md:hidden" style={{ width: 42, height: 4, borderRadius: 4, background: 'var(--text-subtle)', opacity: 0.6 }} />
            <div className="text-[19px] font-extrabold" style={{ ...display, color: 'var(--text-primary)' }}>View the app as</div>
            {([
              { id: 'manager' as const, letter: 'M', title: 'Manager', text: 'Today, board, bookings, reports' },
              { id: 'player' as const, letter: 'P', title: 'Player', text: 'Book a court, open play, my games' },
            ]).map(o => {
              const selected = o.id === mode
              return (
                <button key={o.id} type="button" onClick={() => choose(o.id)} aria-pressed={selected}
                  className="flex items-center gap-3.5 w-full text-left rounded-2xl p-3.5 mt-3"
                  style={{
                    minHeight: 68,
                    background: selected ? 'var(--brand-primary-muted)' : 'var(--bg-raised)',
                    border: `1px solid ${selected ? 'var(--brand-primary)' : 'var(--border)'}`,
                  }}>
                  <span className="inline-flex items-center justify-center rounded-[11px] font-extrabold shrink-0"
                    style={{ width: 34, height: 34, background: selected ? 'var(--brand-primary)' : 'var(--bg-surface)', color: selected ? 'var(--brand-primary-on)' : 'var(--text-primary)', border: selected ? 'none' : '1px solid var(--border)' }}>{o.letter}</span>
                  <span className="min-w-0">
                    <span className="block text-[14.5px] font-extrabold" style={{ color: 'var(--text-primary)' }}>{o.title}</span>
                    <span className="block text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{o.text}</span>
                  </span>
                  <span aria-hidden className="ml-auto shrink-0 rounded-full"
                    style={{ width: 22, height: 22, border: `2px solid ${selected ? 'var(--brand-primary)' : 'var(--text-subtle)'}`, background: selected ? 'radial-gradient(circle, var(--brand-primary) 0 45%, transparent 50%)' : 'transparent' }} />
                </button>
              )
            })}
            <p className="text-center text-[11.5px] mt-3.5" style={{ color: 'var(--text-subtle)' }}>Only managers and staff see this switch.</p>
          </div>
        </div>
      )}
    </>
  )
}
