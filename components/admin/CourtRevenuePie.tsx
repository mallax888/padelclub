'use client'

import { useState } from 'react'
import type { CourtRevenue, CourtRevenueRow } from '@/lib/court-revenue'
import { formatPrice, type CurrencyCode } from '@/lib/currency'
import MoneyBubble from '@/components/ui/MoneyBubble'
import { CourtBadge } from '@/components/admin/ClubMap'

const card = { background: 'var(--bg-surface)', border: '1px solid var(--border)' } as const
const SOLD = '#1f9a5f' // green: what is sold

// Today's takings court by court: one pie each (what is booked against what the court could earn), or the same day hour by hour.
// One switch changes every court together; the club total is one bar underneath.
const money = (n: number, c: CurrencyCode) => formatPrice(n, c).replace(/\.00$/, '')

// The glowing ring: what is sold of what the court could earn today, with % sold in the middle.
function GlowRing({ row }: { row: CourtRevenueRow }) {
  const s = 100, w = 11, r = s / 2 - w / 2 - 3, L = 2 * Math.PI * r
  const pct = row.pct ?? 0, f = L * Math.min(100, pct) / 100, id = `ring-${row.id}`
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} className="shrink-0" style={{ overflow: 'visible' }} role="img" aria-label={`${row.name}: ${pct}% of what it could earn today is booked`} data-testid="court-pie">
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7ff0b9" /><stop offset="1" stopColor="#1f9a5f" /></linearGradient>
        <filter id={`${id}-f`} x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <circle cx={s / 2} cy={s / 2} r={r} fill="none" strokeWidth={w} style={{ stroke: 'var(--board-cell-strong, rgba(127,140,155,0.18))' }} />
      {f > 0 && <circle cx={s / 2} cy={s / 2} r={r} fill="none" strokeWidth={w} stroke={`url(#${id}-g)`} strokeDasharray={`${f} ${L}`} strokeLinecap="round" transform={`rotate(-90 ${s / 2} ${s / 2})`} filter={`url(#${id}-f)`} />}
      <text x="50%" y="50%" textAnchor="middle" fontSize="21" fontWeight="900" style={{ fill: 'var(--text-primary)' }}>{pct}%</text>
      <text x="50%" y="65%" textAnchor="middle" fontSize="9.5" fontWeight="800" letterSpacing="1" style={{ fill: 'var(--text-muted)' }}>SOLD</text>
    </svg>
  )
}

// The court's day, hour by hour: green where it is booked, striped where it is blocked, with a line where the day is up to.
function DayStrip({ row, nowMinutes }: { row: CourtRevenueRow; nowMinutes?: number }) {
  const first = row.hours[0]?.hour ?? 0, n = row.hours.length || 1
  const nowAt = nowMinutes === undefined ? null : (nowMinutes / 60 - first) / n
  const marks = [0, 0.25, 0.5, 0.75, 1].map(f => first + Math.round(f * n))
  return (
    <div className="mt-5" data-testid="court-day-strip">
      <div className="relative grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {row.hours.map(x => (
          <span key={x.hour} className="rounded-[4px]" data-booked={x.state === 'booked' ? 'yes' : 'no'} style={{ height: 14, background: x.state === 'booked' ? 'linear-gradient(180deg,#34d58a,#1f9a5f)' : x.state === 'blocked' ? 'repeating-linear-gradient(45deg, rgba(196,52,58,0.45) 0 3px, rgba(196,52,58,0.15) 3px 6px)' : 'var(--board-cell-strong, rgba(127,140,155,0.18))' }} />
        ))}
        {nowAt !== null && nowAt > 0 && nowAt < 1 && <span aria-hidden className="absolute rounded-full" data-testid="court-day-strip-now" style={{ left: `${nowAt * 100}%`, top: -4, bottom: -4, width: 2, background: 'var(--text-primary)' }} />}
      </div>
      <div className="flex justify-between mt-1.5 text-[10.5px] font-bold" style={{ color: 'var(--text-muted)' }}>{marks.map((h, i) => <span key={i}>{fmtClock12(h)}</span>)}</div>
    </div>
  )
}
const fmtClock12 = (h: number) => (h % 24 === 0 ? '12 am' : h < 12 ? `${h} am` : h === 12 ? '12 pm' : `${h - 12} pm`)
const nextFree = (row: CourtRevenueRow, nowMinutes?: number) => {
  const from = nowMinutes === undefined ? 0 : Math.ceil(nowMinutes / 60)
  const h = row.hours.find(x => x.hour >= from && x.state === 'open')?.hour
  return h === undefined ? null : fmtClock12(h)
}
const chip = { background: 'var(--bg-raised)', color: 'var(--text-primary)' } as const

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

export default function CourtRevenuePie({ revenue, currency, nowMinutes }: { revenue: CourtRevenue; currency: CurrencyCode; nowMinutes?: number }) {
  const [view, setView] = useState<'pie' | 'graph'>('pie')
  const pct = revenue.pct ?? 0
  const seg = (v: 'pie' | 'graph', text: string) => (
    <button type="button" onClick={() => setView(v)} aria-pressed={view === v} data-testid={`court-revenue-${v}`}
      className="text-[12px] font-extrabold px-4 py-1.5 rounded-full" style={view === v ? { background: 'var(--today-block-bg)', color: 'var(--today-block-fg)', boxShadow: 'var(--today-block-shadow)' } : { background: 'transparent', color: 'var(--text-primary)', opacity: 0.8 }}>{text}</button>
  )
  return (
    <section className="rounded-[20px] p-5" style={{ ...card, background: 'var(--board-card)', boxShadow: 'var(--shadow-float)' }} data-testid="court-revenue">
      <div className="flex items-center gap-3 mb-4">
        <h3 className="text-[11.5px] font-extrabold uppercase" style={{ letterSpacing: '0.12em', color: 'var(--text-primary)' }}>Today&apos;s takings</h3>
        {/* The club total sits up here, so the cards below can be short. */}
        <span className="hidden sm:inline-flex items-baseline gap-2 rounded-full px-3.5 py-1.5" data-testid="court-revenue-total" style={{ background: 'rgba(95,224,163,0.10)', border: '1px solid rgba(95,224,163,0.28)' }}>
          <span className="text-[11.5px] font-bold" style={{ color: 'var(--text-muted)' }}>Club total</span>
          <b className="text-[17px]" style={{ color: 'var(--go-text)' }}>{money(revenue.booked, currency)}</b>
          <span className="text-[12.5px]" style={{ color: 'var(--text-muted)' }}>of {money(revenue.possible, currency)} · {pct}% sold</span>
        </span>
        <div className="ml-auto inline-flex p-[3px] rounded-full" style={{ background: 'var(--bg-raised)' }}>{seg('pie', 'Pie')}{seg('graph', 'Graph')}</div>
      </div>
      {view === 'graph' && <p className="text-[12.5px] -mt-2 mb-4 font-semibold" style={{ color: 'var(--text-muted)' }}>Each column is an hour</p>}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        {revenue.rows.map((r) => {
          const free = nextFree(r, nowMinutes)
          const share = revenue.booked > 0 && r.booked > 0 ? Math.round((r.booked / revenue.booked) * 100) : null
          return view === 'pie' ? (
            <div key={r.id} className="rounded-[20px] p-5" data-testid="court-revenue-card"
              style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015))', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-3">
                <CourtBadge name={r.name} testId="court-revenue-court" />
                <span className="text-[12.5px] font-semibold" style={{ color: 'var(--text-muted)' }}>{r.bookedHours > 0 ? `${r.bookedHours} of ${r.sellableHours} hours booked` : 'Nothing booked yet'}</span>
                {free && <span className="ml-auto text-[12px] font-extrabold rounded-full px-3 py-1 whitespace-nowrap" style={chip} data-testid="court-next-free">Next free {free}</span>}
              </div>
              <div className="flex items-center gap-5 mt-4">
                <GlowRing row={r} />
                <div className="min-w-0">
                  <div className="text-[34px] font-black leading-none" style={{ letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>{money(r.booked, currency)}</div>
                  <div className="text-[12.5px] mt-1.5" style={{ color: 'var(--text-muted)' }}>booked of {money(r.possible, currency)}</div>
                  {share !== null && <div className="mt-2"><MoneyBubble kind="gain" size={11}>{share}% of today</MoneyBubble></div>}
                </div>
              </div>
              <DayStrip row={r} nowMinutes={nowMinutes} />
            </div>
          ) : (
            <div key={r.id} className="rounded-[20px] p-5 text-center" style={{ background: 'var(--board-cell)' }} data-testid="court-revenue-card">
              <div className="flex justify-center mb-3"><CourtBadge name={r.name} testId="court-revenue-court" /></div>
              <div className="mb-1"><Hours row={r} colour={SOLD} maxFee={revenue.maxFee} /></div>
              <div className="flex items-center justify-center gap-2 mt-3">
                <MoneyBubble kind={(r.pct ?? 0) > 0 ? 'gain' : 'none'} size={11}>{r.pct ?? 0}% sold</MoneyBubble>
                <span className="text-[12.5px] font-bold" style={{ color: 'var(--text-primary)' }}>{money(r.booked, currency)} of {money(r.possible, currency)}</span>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
