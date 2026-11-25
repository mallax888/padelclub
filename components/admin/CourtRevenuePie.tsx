'use client'

import { useState } from 'react'
import type { CourtRevenue, CourtRevenueRow } from '@/lib/court-revenue'
import { formatPrice, type CurrencyCode } from '@/lib/currency'
import MoneyBubble from '@/components/ui/MoneyBubble'
import { CourtBadge } from '@/components/admin/ClubMap'

const card = { background: 'var(--bg-surface)', border: '1px solid var(--border)' } as const
const SOLD = '#1f9a5f' // green: what is sold
const R = 64
const C = 2 * Math.PI * R

// Today's takings court by court: one pie each (what is booked against what the court could earn), or the same day hour by hour.
// One switch changes every court together; the club total is one bar underneath.
function Pie({ row, colour, currency }: { row: CourtRevenueRow; colour: string; currency: CurrencyCode }) {
  const arc = row.possible > 0 ? Math.min(1, row.booked / row.possible) * C : 0
  return (
    <div className="relative mx-auto" style={{ width: 150, height: 150 }} data-testid="court-pie">
      <svg viewBox="0 0 160 160" width="150" height="150" role="img" aria-label={`${row.name}: ${row.pct ?? 0}% of what it could earn today is booked`}>
        <circle cx="80" cy="80" r={R} fill="none" strokeWidth="22" style={{ stroke: 'var(--board-cell)' }} />
        {arc > 0 && <circle cx="80" cy="80" r={R} fill="none" strokeWidth="22" strokeDasharray={`${arc} ${C - arc}`} transform="rotate(-90 80 80)" style={{ stroke: colour }} />}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <b className="text-[22px] font-extrabold leading-none" style={{ color: 'var(--text-primary)' }}>{money(row.booked, currency)}</b>
        <span className="text-[11.5px] mt-1 font-bold" style={{ color: 'var(--text-muted)' }}>booked of {money(row.possible, currency)}</span>
      </div>
    </div>
  )
}
const money = (n: number, c: CurrencyCode) => formatPrice(n, c).replace(/\.00$/, '')

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
      className="text-[12px] font-extrabold px-4 py-1.5 rounded-full" style={view === v ? { background: 'var(--today-block-bg)', color: 'var(--today-block-fg)', boxShadow: 'var(--today-block-shadow)' } : { background: 'transparent', color: 'var(--text-primary)', opacity: 0.8 }}>{text}</button>
  )
  return (
    <section className="rounded-[20px] p-5" style={{ ...card, background: 'var(--board-card)', boxShadow: 'var(--shadow-float)' }} data-testid="court-revenue">
      <div className="flex items-center gap-3 mb-4">
        <h3 className="text-[11.5px] font-extrabold uppercase" style={{ letterSpacing: '0.12em', color: 'var(--text-primary)' }}>Today&apos;s takings by court</h3>
        <div className="ml-auto inline-flex p-[3px] rounded-full" style={{ background: 'var(--bg-raised)' }}>{seg('pie', 'Pie')}{seg('graph', 'Graph')}</div>
      </div>
      {view === 'graph' && <p className="text-[12.5px] -mt-2 mb-4 font-semibold" style={{ color: 'var(--text-muted)' }}>Each column is an hour</p>}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
        {revenue.rows.map((r) => {
          const colour = SOLD
          return (
            <div key={r.id} className="rounded-[20px] p-5 text-center" style={{ background: 'var(--board-cell)' }} data-testid="court-revenue-card">
              <div className="flex justify-center mb-3"><CourtBadge name={r.name} testId="court-revenue-court" /></div>
              {view === 'pie' ? <Pie row={r} colour={colour} currency={currency} /> : (
                <div className="mb-1"><Hours row={r} colour={colour} maxFee={revenue.maxFee} /></div>
              )}
              <div className="flex items-center justify-center gap-2 mt-3">
                <MoneyBubble kind={(r.pct ?? 0) > 0 ? 'gain' : 'none'} size={11}>{r.pct ?? 0}% sold</MoneyBubble>
                {view === 'graph' && <span className="text-[12.5px] font-bold" style={{ color: 'var(--text-primary)' }}>{money(r.booked, currency)} of {money(r.possible, currency)}</span>}
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-4 flex items-center gap-3" data-testid="court-revenue-total">
        <span className="text-[13px] font-extrabold whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>Club total</span>
        <div className="flex-1 rounded-full overflow-hidden" style={{ height: 10, background: 'var(--board-cell)' }}>
          <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: SOLD, borderRadius: 99 }} />
        </div>
        <b className="text-[13px] whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{money(revenue.booked, currency)} booked of {money(revenue.possible, currency)}</b>
      </div>
    </section>
  )
}
