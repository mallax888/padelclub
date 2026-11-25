'use client'

import type { ReactNode } from 'react'
import type React from 'react'

// The row the first steps of Book a court are built from, the same as a booking in My bookings (cities, clubs, lengths). It only draws;
// BookingFlow decides what a tap does.

// One row, the same as a booking in My bookings: a blue tile on the left (a small label over a big number), a small line, a big title and a
// quiet line under it, the price and a chip on the right, and a chevron. Cities, clubs and lengths in Book a court all use it.
export type RowChip = { text: string; kind?: 'lime' | 'green' | 'muted' | 'blue' }
const CHIP: Record<string, React.CSSProperties> = {
  lime: { background: '#d4f53c', color: '#17240a' }, green: { background: 'var(--brand-green-muted)', color: 'var(--brand-green)' },
  muted: { background: 'var(--bg-raised)', color: 'var(--text-muted)' }, blue: { background: 'var(--brand-primary-muted)', color: 'var(--brand-primary-text)' },
}
export function BookRow({ label, value, muted, eyebrow, title, sub, price, priceBig, chip, picked, dim, onClick, testid, extra }: {
  label: string; value: ReactNode; muted?: boolean; eyebrow?: string; title: string; sub?: string; price?: ReactNode; priceBig?: boolean; chip?: RowChip; picked?: boolean; dim?: boolean
  onClick: () => void; testid?: string; extra?: Record<string, string | number | undefined>
}) {
  const on = !!picked
  return (
    <button type="button" onClick={onClick} data-testid={testid} data-picked={on ? 'yes' : undefined} {...(extra ?? {})}
      className="w-full flex items-center gap-3 rounded-[20px] p-4 text-left transition-colors"
      style={on ? { background: 'var(--today-block-bg)', border: '1px solid transparent', color: 'var(--today-block-fg)', boxShadow: 'var(--today-block-shadow)' } : { background: 'var(--bg-surface)', border: '1px solid var(--border)', opacity: dim ? 0.7 : 1 }}
      onMouseEnter={e => { if (!on) e.currentTarget.style.borderColor = 'var(--brand-primary)' }} onMouseLeave={e => { if (!on) e.currentTarget.style.borderColor = 'var(--border)' }}>
      <span aria-hidden className="shrink-0 flex flex-col items-center justify-center text-white"
        style={{ width: 52, height: 52, borderRadius: 16, background: muted ? 'linear-gradient(160deg, #3a4150, #2b313c)' : 'linear-gradient(160deg, #2c5fc4, #1d3f8d)' }}>
        <span className="font-black" style={{ fontSize: 8, letterSpacing: '0.12em', color: '#cfe0ff' }}>{label}</span>
        <span className="font-black leading-none" style={{ fontSize: String(value).length > 2 ? 15 : 22 }}>{value}</span>
      </span>
      <span className="min-w-0 flex-1">
        {eyebrow && <span className="block text-[10.5px] font-extrabold uppercase" style={{ letterSpacing: '0.08em', color: on ? 'var(--today-block-fg)' : 'var(--text-muted)' }}>{eyebrow}</span>}
        {priceBig && price
          ? <span className="block text-[24px] font-black leading-tight" data-testid="row-price" style={{ color: on ? 'var(--today-block-fg)' : 'var(--go-text)', letterSpacing: '-0.02em' }}>{price}</span>
          : <span className="block text-[18px] font-black leading-tight" style={{ color: on ? 'var(--today-block-fg)' : 'var(--text-primary)', letterSpacing: '-0.02em' }}>{title}</span>}
        {sub && <span className="block text-[11.5px] mt-0.5" style={{ color: on ? 'var(--today-block-fg)' : 'var(--text-muted)' }}>{sub}</span>}
      </span>
      {((price && !priceBig) || chip) && (
        <span className="shrink-0 flex flex-col items-end gap-1.5">
          {price && !priceBig && <span className="text-[15px] font-black" data-testid="row-price" style={{ color: on ? 'var(--today-block-fg)' : 'var(--go-text)' }}>{price}</span>}
          {chip && <span className="text-[10px] font-black rounded-full px-2 py-0.5 whitespace-nowrap" style={CHIP[chip.kind ?? 'green']}>{chip.text}</span>}
        </span>
      )}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: on ? 'var(--today-block-fg)' : 'var(--text-subtle)', flexShrink: 0 }}><path d="M9 6l6 6-6 6" /></svg>
    </button>
  )
}
