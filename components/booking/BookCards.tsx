'use client'

import { useMemo, useState, type ReactNode } from 'react'

// The pieces the first steps of Book a court are built from: a card with a court picture on top (cities and clubs), a whole-month calendar,
// and a full-circle dial for how long. They only draw things; BookingFlow decides what a tap does.

const TINTS: [string, string][] = [['#2c5fc4', '#1d3f8d'], ['#1f7a7a', '#16505a'], ['#5a46c4', '#37297f']]

export function CourtArt({ index, club }: { index: number; club?: boolean }) {
  const [a, b] = TINTS[index % TINTS.length]
  return (
    <div className="relative overflow-hidden h-[66px] lg:h-[92px]" style={{ background: `linear-gradient(140deg, ${a}, ${b})`, borderRadius: '16px 16px 0 0' }} aria-hidden>
      <svg viewBox="0 0 200 100" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full">
        <g fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.4">
          <rect x="20" y="10" width="160" height="80" rx="3" /><line x1="100" y1="10" x2="100" y2="90" /><line x1="50" y1="10" x2="50" y2="90" />
          <line x1="150" y1="10" x2="150" y2="90" /><line x1="50" y1="50" x2="150" y2="50" />
        </g>
      </svg>
      {club && <span className="absolute left-2.5 top-2.5 rounded-full px-2 py-0.5 text-[10.5px] font-extrabold" style={{ background: '#d4f53c', color: '#1b2300' }}>Your club</span>}
    </div>
  )
}

export function PlaceCard({ index, title, sub, pill, club, dim, onClick, testid }: {
  index: number; title: string; sub: string; pill: string; club?: boolean; dim?: boolean; onClick: () => void; testid?: string
}) {
  return (
    <button type="button" onClick={onClick} data-testid={testid} className="w-full text-left rounded-[18px] transition-all overflow-hidden"
      style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', opacity: dim ? 0.6 : 1 }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--brand-primary)')} onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
      <CourtArt index={index} club={club} />
      <span className="flex items-center gap-2 px-3.5 py-3">
        <span className="min-w-0">
          <span className="block text-[16px] font-extrabold" style={{ color: 'var(--text-primary)' }}>{title}</span>
          <span className="block text-[12.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</span>
        </span>
        <span className="ml-auto shrink-0 text-[12px] font-extrabold rounded-full px-2.5 py-1 whitespace-nowrap" style={{ background: 'var(--brand-green-muted)', color: 'var(--go-text)' }}>{pill}</span>
      </span>
    </button>
  )
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const pad = (n: number) => String(n).padStart(2, '0')

// The whole month, Monday first. Days you can book are bright boxes; days outside the booking window are dimmed; days that belong to the
// previous or next month are much lighter. A small orange dot marks a busy day.
export function MonthCalendar({ bookable, picked, isBusy, onPick }: { bookable: string[]; picked: string | null; isBusy: (d: string) => boolean; onPick: (d: string) => void }) {
  const first = bookable[0]
  const [ym, setYm] = useState<string>((picked ?? first ?? new Date().toISOString().slice(0, 10)).slice(0, 7))
  const set = useMemo(() => new Set(bookable), [bookable])
  const [y, m] = ym.split('-').map(Number)
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7
  const daysIn = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const rows = Math.ceil((lead + daysIn) / 7)
  const cells = Array.from({ length: rows * 7 }, (_, i) => {
    const t = new Date(Date.UTC(y, m - 1, 1 - lead + i))
    const d = `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
    return { d, n: t.getUTCDate(), other: t.getUTCMonth() !== m - 1, on: set.has(d) }
  })
  const shift = (k: number) => { const t = new Date(Date.UTC(y, m - 1 + k, 1)); setYm(`${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}`) }
  const lastMonth = (bookable[bookable.length - 1] ?? ym).slice(0, 7), firstMonth = (first ?? ym).slice(0, 7)
  const nav = (k: number, label: string, off: boolean) => (
    <button type="button" aria-label={label} disabled={off} onClick={() => shift(k)} className="inline-flex items-center justify-center rounded-full ml-2"
      style={{ width: 34, height: 34, background: 'var(--bg-raised)', color: 'var(--text-muted)', opacity: off ? 0.35 : 1, fontSize: 18 }}>{k < 0 ? '‹' : '›'}</button>
  )
  return (
    <div data-testid="month-calendar">
      <div className="flex items-center justify-between mb-3">
        <b className="text-[15px]" style={{ color: 'var(--text-primary)' }}>{MONTHS[m - 1]} {y}</b>
        <span>{nav(-1, 'Previous month', ym <= firstMonth)}{nav(1, 'Next month', ym >= lastMonth)}</span>
      </div>
      <div className="grid grid-cols-7 gap-1.5 lg:gap-2 text-center">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((x, i) => <div key={i} className="text-[11px] font-extrabold pb-1" style={{ color: 'var(--text-subtle)' }}>{x}</div>)}
        {cells.map(c => {
          const sel = picked === c.d
          const busy = c.on && isBusy(c.d)
          return (
            <button key={c.d} type="button" disabled={!c.on} data-testid="cal-day" data-date={c.d} data-picked={sel ? 'yes' : undefined} onClick={() => onPick(c.d)}
              aria-label={`${c.d}${busy ? ', busy' : ''}`}
              className="relative flex items-center justify-center font-extrabold h-[46px] lg:h-[54px] text-[16px] lg:text-[18px] rounded-[14px] lg:rounded-2xl leading-none"
              style={sel ? { background: 'linear-gradient(160deg, #2c5fc4, #1d3f8d)', border: '1px solid #6ea0ff', color: '#fff', boxShadow: '0 0 0 3px rgba(110,160,255,0.28)' }
                : { background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-primary)', opacity: c.other ? 0.22 : c.on ? 1 : 0.45, fontWeight: c.other ? 600 : 800, cursor: c.on ? 'pointer' : 'default' }}>
              {c.n}
              {busy && <span aria-hidden className="absolute" style={{ bottom: 5, left: '50%', marginLeft: -2.5, width: 5, height: 5, borderRadius: 3, background: sel ? '#ffd2c4' : 'var(--brand-accent)' }} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// A full circle in blue, or in white when it is the one picked. The number sits inside, the price under it.
export function LengthDial({ minutes, price, picked, onClick }: { minutes: number; price: ReactNode; picked: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} data-picked={picked ? 'yes' : undefined} data-testid="length-dial" className="rounded-[20px] px-2 pt-4 pb-3.5 text-center transition-all"
      style={picked ? { background: 'linear-gradient(160deg, #2c5fc4, #1d3f8d)', border: '1.5px solid #6ea0ff', boxShadow: '0 0 0 3px rgba(110,160,255,0.28)', color: '#fff' } : { background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
      <span className="relative block mx-auto mb-2.5" style={{ width: 76, height: 76 }}>
        <svg width="76" height="76" viewBox="0 0 76 76" className="absolute inset-0" aria-hidden><circle cx="38" cy="38" r="32" fill="none" stroke={picked ? '#ffffff' : '#6ea0ff'} strokeWidth="6" /></svg>
        <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
          <b className="text-[24px] font-black">{minutes}</b>
          <em className="not-italic text-[10px] font-bold mt-0.5" style={{ opacity: 0.8 }}>min</em>
        </span>
      </span>
      <span className="block text-[16px] font-extrabold" data-testid="length-price" style={{ color: picked ? '#ffffff' : 'var(--go-text)' }}>{price}</span>
    </button>
  )
}
