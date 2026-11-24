'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { fmtClock } from '@/lib/clock'
import { formatPrice, type CurrencyCode } from '@/lib/currency'

// The Bookings list on a phone: one small card per booking (court tile, who, when, amount and status). Swipe a card left
// (or press and hold it) and a red Cancel appears behind it. The swipe only reveals the button: cancelling is still the
// tap on Cancel, and the dashboard's own "are you sure" comes after that.

export type BookingCardRow = {
  id: string
  date: string
  start_time: string
  status: string
  price_nzd: number
  profiles: { full_name: string | null } | null
  courts: { name: string; venue_slug?: string | null } | null
}

const PANEL = 96            // width of the red Cancel behind a card
const OPEN_AT = 40          // how far a swipe must go to stay open
const HOLD_MS = 550         // press and hold
const HINT_KEY = 'padelmate-swipe-hint'

const BALL = '#d4f53c'
const INK = '#17240a'

const day = (date: string) => new Intl.DateTimeFormat('en-NZ', { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(new Date(date + 'T12:00:00Z'))
const courtNumber = (name: string | undefined | null) => (name?.match(/\d+/)?.[0] ?? (name ?? '?').slice(0, 1))

function chip(status: string): { background: string; color: string } {
  if (status === 'confirmed') return { background: 'var(--brand-green-muted)', color: 'var(--brand-green)' }
  if (status === 'pending') return { background: BALL, color: INK }
  if (status === 'cancelled') return { background: 'rgba(229,72,77,0.16)', color: 'var(--brand-crimson)' }
  return { background: 'var(--bg-raised)', color: 'var(--text-muted)' }
}

const canCancel = (status: string) => status !== 'cancelled' && status !== 'blocked'

export default function BookingCards({ rows, showMoney, currencyFor, onCancel, emptyText }: {
  rows: BookingCardRow[]
  showMoney: boolean
  currencyFor: (venueSlug: string | null | undefined) => CurrencyCode
  onCancel: (id: string) => Promise<void> | void
  emptyText: string
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [drag, setDrag] = useState<{ id: string; dx: number } | null>(null)
  const [hintLeft, setHintLeft] = useState(false)
  const start = useRef<{ id: string; x: number; y: number; moved: boolean; opened: boolean } | null>(null)
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null)
  const justOpened = useRef(false)
  // The live drag, for the release handler: state can be a render behind when the finger lifts.
  const dragNow = useRef<{ id: string; dx: number } | null>(null)

  // The hint ("Swipe a booking left to cancel it") shows until someone has opened Cancel twice on this phone.
  useEffect(() => {
    try { setHintLeft(Number(localStorage.getItem(HINT_KEY) ?? '0') < 2) } catch { setHintLeft(true) }
  }, [])
  const countOpen = useCallback(() => {
    try {
      const n = Number(localStorage.getItem(HINT_KEY) ?? '0') + 1
      localStorage.setItem(HINT_KEY, String(n)); if (n >= 2) setHintLeft(false)
    } catch { /* no storage: the hint just stays */ }
  }, [])
  const open = useCallback((id: string) => { setOpenId(id); countOpen() }, [countOpen])

  // A tap anywhere else closes the open card.
  useEffect(() => {
    if (!openId) return
    const close = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest('[data-booking-id]')
      if (el?.getAttribute('data-booking-id') !== openId) setOpenId(null)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [openId])

  const clearHold = () => { if (hold.current) { clearTimeout(hold.current); hold.current = null } }

  const down = (e: React.PointerEvent, id: string, cancellable: boolean) => {
    if (!cancellable) return
    start.current = { id, x: e.clientX, y: e.clientY, moved: false, opened: false }
    justOpened.current = false
    clearHold()
    hold.current = setTimeout(() => {
      if (start.current && !start.current.moved) { start.current.opened = true; justOpened.current = true; open(id); setDrag(null) }
    }, HOLD_MS)
  }
  const move = (e: React.PointerEvent, id: string) => {
    const s = start.current
    if (!s || s.id !== id) return
    const dx = e.clientX - s.x, dy = e.clientY - s.y
    if (!s.moved && Math.abs(dx) < 6) return
    if (!s.moved && Math.abs(dy) > Math.abs(dx)) { clearHold(); start.current = null; return }
    s.moved = true; clearHold()
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    dragNow.current = { id, dx }
    setDrag({ id, dx })
  }
  const up = (id: string) => {
    clearHold()
    const s = start.current; start.current = null
    if (!s || s.id !== id) return
    const d = dragNow.current; dragNow.current = null
    if (s.moved && d?.id === id) {
      const base = openId === id ? -PANEL : 0
      const x = Math.max(-PANEL, Math.min(0, base + d.dx))
      if (x <= -OPEN_AT) { if (openId !== id) open(id) } else setOpenId(cur => (cur === id ? null : cur))
    } else if (!s.opened && openId === id && !justOpened.current) {
      setOpenId(null)    // a tap on an open card closes it
    }
    setDrag(null)
  }

  if (rows.length === 0) {
    return <div className="rounded-2xl px-4 py-8 text-center text-sm" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>{emptyText}</div>
  }
  const anyCancellable = rows.some(r => canCancel(r.status))

  return (
    <div data-testid="booking-cards">
      {hintLeft && anyCancellable && (
        <p className="text-[12px] mb-2 px-1" data-testid="swipe-hint" style={{ color: 'var(--text-muted)' }}>Swipe a booking left to cancel it</p>
      )}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
        {rows.map((b, i) => {
          const cancellable = canCancel(b.status)
          const base = openId === b.id ? -PANEL : 0
          const x = drag?.id === b.id ? Math.max(-PANEL, Math.min(0, base + drag.dx)) : base
          const name = b.profiles?.full_name ?? '—'
          const price = showMoney && b.price_nzd > 0 ? formatPrice(b.price_nzd, currencyFor(b.courts?.venue_slug)).replace(/\.00$/, '') : null
          const st = chip(b.status)
          return (
            <div key={b.id} data-testid="booking-card" data-booking-id={b.id} data-status={b.status} data-open={openId === b.id ? 'yes' : 'no'}
              className="relative overflow-hidden" style={{ borderTop: i ? '1px solid var(--border)' : 'none' }}>
              {cancellable && (
                <button type="button" data-testid="booking-cancel" aria-label={`Cancel the ${fmtClock(b.start_time)} booking for ${name}`}
                  tabIndex={openId === b.id ? 0 : -1}
                  onFocus={() => open(b.id)}
                  onClick={async () => { await onCancel(b.id); setOpenId(null) }}
                  className="absolute top-0 right-0 bottom-0 flex items-center justify-center text-[13px] font-black text-white"
                  style={{ width: PANEL, background: '#e5484d' }}>Cancel</button>
              )}
              <div className="relative flex items-center gap-3 px-4 py-3" data-testid="booking-face"
                style={{ background: 'var(--bg-surface)', touchAction: 'pan-y', transform: `translateX(${x}px)`, transition: drag?.id === b.id ? 'none' : 'transform 180ms ease', userSelect: 'none', WebkitUserSelect: 'none' }}
                onPointerDown={e => down(e, b.id, cancellable)} onPointerMove={e => move(e, b.id)}
                onPointerUp={() => up(b.id)} onPointerCancel={() => { clearHold(); start.current = null; dragNow.current = null; setDrag(null) }}>
                <span className="shrink-0 inline-flex items-center justify-center rounded-[10px] font-black text-white" aria-label={`Court ${courtNumber(b.courts?.name)}`}
                  style={{ width: 38, height: 38, background: '#1d3f8d', fontSize: 20, lineHeight: 1 }}>{courtNumber(b.courts?.name)}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-bold truncate" style={{ color: 'var(--text-primary)' }}>{name}</div>
                  <div className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    <b style={{ color: 'var(--brand-primary-text)' }}>{fmtClock(b.start_time)}</b> · {day(b.date)}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  {showMoney && <div className="text-[14px] font-extrabold" style={{ color: 'var(--text-primary)' }}>{price ?? '—'}</div>}
                  <span className="inline-block text-[10.5px] font-extrabold rounded-full px-2 py-0.5 mt-0.5" style={st}>{b.status}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
