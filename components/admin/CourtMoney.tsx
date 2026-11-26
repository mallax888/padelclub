'use client'

import type { CourtRevenueRow } from '@/lib/court-revenue'

// The money pieces on each court card on Today (owners only): a glowing ring of what is sold, the day hour by hour, or the
// same day as columns sized by each hour's fee.
// The glowing ring: what is sold of what the court could earn today, with % sold in the middle.
export function GlowRing({ row }: { row: CourtRevenueRow }) {
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
export function DayStrip({ row, nowMinutes }: { row: CourtRevenueRow; nowMinutes?: number }) {
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

export function Hours({ row, colour, maxFee }: { row: CourtRevenueRow; colour: string; maxFee: number }) {
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

