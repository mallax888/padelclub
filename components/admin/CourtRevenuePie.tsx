'use client'

import { useState } from 'react'
import type { CourtRevenue, CourtRevenueRow } from '@/lib/court-revenue'
import { formatPrice, type CurrencyCode } from '@/lib/currency'

const card = { background: 'var(--bg-surface)', border: '1px solid var(--border)' } as const
const COLOURS = ['var(--court-1)', 'var(--court-2)', 'var(--court-3)', '#9085e9', '#e87ba4', '#c98500'] // a court keeps its colour by number, never by rank
const R = 64
const C = 2 * Math.PI * R

// Today's takings court by court: one pie each (what is booked against what the court could earn), or the same day hour by hour.
// One switch changes every court together; the club total is one bar underneath.
function Pie({ row, colour }: { row: CourtRevenueRow; colour: string }) {
  const arc = row.possible > 0 ? Math.min(1, row.booked / row.possible) * C : 0
  return (
    <div className="relative mx-auto" style={{ width: 150, height: 150 }} data-testid="court-pie">
      <svg viewBox="0 0 160 160" width="150" height="150" role="img" aria-label={`${row.name}: ${row.pct ?? 0}% of what it could earn today is booked`}>
        <circle cx="80" cy="80" r={R} fill="none" strokeWidth="24" style={{ stroke: 'var(--bg-raised)' }} />
        {arc > 0 && <circle cx="80" cy="80" r={R} fill="none" strokeWidth="24" strokeDasharray={`${arc} ${C - arc}`} transform="rotate(-90 80 80)" style={{ stroke: colour }} />}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <b className="text-[24px] font-extrabold leading-none" style={{ color: 'var(--text-primary)' }}>{row.pct ?? 0}%</b>
        <span className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>booked</span>
      </div>
    </div>
  )
}

function Hours({ row, colour, maxFee }: { row: CourtRevenueRow; colour: string; maxFee: number }) {
  const h = 92
  return (
    <div data-testid="court-hours">
      <div className="flex items-end gap-[3px]" style={{ height: h }} role="img" aria-label={`${row.name}: ${row.bookedHours} of ${row.sellableHours} hours booked`}>
        {row.hours.map(x => (
          <div key={x.hour} className="flex-1 rounded-[3px] flex items-end" data-booked={x.state === 'booked' ? 'yes' : 'no'}
            style={{ height: x.state === 'blocked' ? 6 : h, background: x.state === 'blocked' ? 'var(--border)' : 'var(--bg-raised)' }}>
            {x.state === 'booked' && <div className="w-full rounded-[3px]" style={{ height: `${maxFee > 0 ? Math.max(18, (x.fee / maxFee) * 100) : 100}%`, background: colour }} />}
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1.5 text-[10px]" style={{ color: 'var(--text-subtle)' }}>
        <span>{fmtH(row.hours[0]?.hour)}</span><span>{fmtH(row.hours[Math.floor(row.hours.length / 2)]?.hour)}</span><span>{fmtH(row.hours[row.hours.length - 1]?.hour)}</span>
      </div>
    </div>
  )
}
const fmtH = (h: number | undefined) => (h === undefined ? '' : h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`)

export default function CourtRevenuePie({ revenue, currency }: { revenue: CourtRevenue; currency: CurrencyCode }) {
  const [view, setView] = useState<'pie' | 'graph'>('pie')
  const pct = revenue.pct ?? 0
  const seg = (v: 'pie' | 'graph', text: string) => (
    <button type="button" onClick={() => setView(v)} aria-pressed={view === v} data-testid={`court-revenue-${v}`}
      className="text-[12px] font-extrabold px-3.5 py-1.5 rounded-full" style={view === v ? { background: '#ffffff', color: '#1a2330' } : { background: 'transparent', color: 'var(--text-muted)' }}>{text}</button>
  )
  return (
    <section className="rounded-[20px] p-5" style={card} data-testid="court-revenue">
      <div className="flex items-center gap-3 mb-1">
        <h3 className="text-[11px] font-extrabold uppercase" style={{ letterSpacing: '0.14em', color: 'var(--text-subtle)' }}>Today by court</h3>
        <div className="ml-auto inline-flex p-[3px] rounded-full" style={{ background: 'var(--bg-raised)' }}>{seg('pie', 'Pie')}{seg('graph', 'Graph')}</div>
      </div>
      <p className="text-[12.5px] mb-4" style={{ color: 'var(--text-muted)' }}>
        <b style={{ color: 'var(--text-primary)' }}>{formatPrice(revenue.booked, currency)}</b> booked of {formatPrice(revenue.possible, currency)} possible
        {view === 'graph' ? ' · each column is an hour' : ''}
      </p>
      <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
        {revenue.rows.map((r, i) => {
          const colour = COLOURS[i % COLOURS.length]
          return (
            <div key={r.id} className="rounded-2xl p-4" style={{ background: 'var(--bg-base)', border: '1px solid var(--border)' }} data-testid="court-revenue-card">
              {view === 'pie' ? <Pie row={r} colour={colour} /> : (
                <div className="mb-1"><Hours row={r} colour={colour} maxFee={revenue.maxFee} /></div>
              )}
              <div className={`flex items-center gap-2 ${view === 'pie' ? 'justify-center mt-2.5' : 'mt-3'}`}>
                <i aria-hidden className="rounded" style={{ width: 11, height: 11, background: colour }} />
                <span className="text-[14px] font-extrabold" style={{ color: 'var(--text-primary)' }}>{r.name}</span>
                {view === 'graph' && <span className="ml-auto text-[12px] font-semibold" style={{ color: 'var(--text-muted)' }}>{formatPrice(r.booked, currency)}</span>}
              </div>
              {view === 'pie' && (
                <div className="text-center text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>
                  <b style={{ color: 'var(--text-primary)' }}>{formatPrice(r.booked, currency)}</b> of {formatPrice(r.possible, currency)}<br />
                  {r.bookedHours} of {r.sellableHours} hours
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-4 pt-3.5" style={{ borderTop: '1px solid var(--border)' }} data-testid="court-revenue-total">
        <div className="flex items-baseline justify-between text-[12.5px] mb-2" style={{ color: 'var(--text-muted)' }}>
          <span><b style={{ color: 'var(--text-primary)' }}>All courts</b> · {revenue.bookedHours} of {revenue.sellableHours} hours</span>
          <span>{pct}% of the day&apos;s possible</span>
        </div>
        <div className="rounded-full overflow-hidden" style={{ height: 12, background: 'var(--bg-raised)' }}>
          <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: 'var(--brand-primary)', borderRadius: 99 }} />
        </div>
      </div>
    </section>
  )
}
