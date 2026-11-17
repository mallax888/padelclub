import Link from 'next/link'
import { formatPrice, type CurrencyCode } from '@/lib/currency'
import { describeOpen, type CourtDay, type CourtDayCell } from '@/lib/court-day'

// "Court by court today": for each court, what can still be sold (the big number), how much of the day is
// booked, and an hour-by-hour strip. Hours that have passed are faded; hours still open are dashed yellow.
const card = { background: 'var(--bg-surface)', border: '1px solid var(--border)' } as const
const GRID = '64px minmax(0,1fr)'

function cellStyle(c: CourtDayCell): React.CSSProperties {
  if (c.state === 'booked') return { background: 'var(--brand-primary)', opacity: c.past ? 0.38 : 1 }
  if (c.state === 'blocked') return { background: 'var(--brand-crimson-muted)', border: '1px solid var(--brand-crimson)', opacity: c.past ? 0.55 : 1 }
  return c.past
    ? { background: 'var(--bg-raised)', opacity: 0.7 }
    : { background: 'var(--brand-yellow-muted)', border: '1.5px dashed var(--brand-yellow)' }
}

export default function CourtDayCard({ day, boardHref, currency, showMoney, nowMinutes, fill }: {
  day: CourtDay; boardHref: string; currency: CurrencyCode; showMoney: boolean; nowMinutes: number; fill: React.ReactNode
}) {
  const n = day.endHour - day.firstHour
  const hasBlocked = day.rows.some(r => r.cells.some(c => c.state === 'blocked'))
  const nowAt = n > 0 && nowMinutes >= day.firstHour * 60 && nowMinutes < day.endHour * 60 ? ((nowMinutes / 60 - day.firstHour) / n) * 100 : null
  const summary = day.openNow > 0
    ? `${day.openNow} court-${day.openNow === 1 ? 'hour' : 'hours'} open from now${showMoney && day.openValue > 0 ? ` · ${formatPrice(day.openValue, currency).replace(/\.00$/, '')} still to win` : ''}`
    : day.finished ? 'Today is finished' : 'Sold out from now'
  const labels = Array.from({ length: n }, (_, i) => ({ i, h: day.firstHour + i })).filter(x => x.h % 3 === 0 && (nowAt === null || Math.abs((x.i / n) * 100 - nowAt) > 9))

  return (
    <div className="rounded-[20px] overflow-hidden" style={card} data-testid="court-day">
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-extrabold" style={{ color: 'var(--text-primary)' }} data-testid="court-day-summary">{summary}</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            <span className="inline-flex items-center gap-1.5"><i aria-hidden style={{ width: 14, height: 10, borderRadius: 3, background: 'var(--brand-primary)' }} />Booked</span>
            <span className="inline-flex items-center gap-1.5"><i aria-hidden style={{ width: 14, height: 10, borderRadius: 3, background: 'var(--brand-yellow-muted)', border: '1.5px dashed var(--brand-yellow)' }} />Open, can still be sold</span>
            <span className="inline-flex items-center gap-1.5"><i aria-hidden style={{ width: 14, height: 10, borderRadius: 3, background: 'var(--bg-raised)', opacity: 0.7 }} />Already gone</span>
            {hasBlocked && <span className="inline-flex items-center gap-1.5"><i aria-hidden style={{ width: 14, height: 10, borderRadius: 3, background: 'var(--brand-crimson-muted)', border: '1px solid var(--brand-crimson)' }} />Blocked</span>}
          </div>
        </div>
        {fill}
      </div>

      {n > 0 && (
        <div className="grid gap-3.5 px-4 pt-2" style={{ gridTemplateColumns: GRID }} aria-hidden>
          <span />
          <div className="relative text-[10.5px]" style={{ height: 20, color: 'var(--text-subtle)' }}>
            {labels.map(x => <span key={x.h} className="absolute top-0" style={{ left: `${(x.i / n) * 100}%` }}>{String(x.h).padStart(2, '0')}</span>)}
            {nowAt !== null && <em data-testid="court-day-now" className="absolute top-0 not-italic font-extrabold rounded-md px-1.5" style={{ left: `${nowAt}%`, transform: 'translateX(-50%)', fontSize: 10, background: 'var(--brand-primary-muted)', color: 'var(--brand-primary-text)', whiteSpace: 'nowrap' }}>▼ now</em>}
          </div>
        </div>
      )}

      {day.rows.map(r => {
        const open = describeOpen(r)
        const done = r.sellable === 0
        return (
          <Link key={r.id} href={boardHref} data-testid="court-day-row" className="grid gap-3.5 items-center px-4 py-3" style={{ gridTemplateColumns: GRID, borderTop: '1px solid var(--border)' }}
            aria-label={`${r.name}: ${r.pct === null ? 'not on sale today' : `${r.pct}% booked today`}${open ? `, ${open}` : ', nothing left to sell'}`}>
            <div className="text-center" aria-hidden>
              {done ? <div className="text-[22px] font-black leading-none" style={{ color: 'var(--text-subtle)' }}>–</div>
                : r.openNow > 0 ? <><div className="text-[30px] font-black leading-none" style={{ color: 'var(--open-text)', letterSpacing: '-0.02em' }} data-testid="court-open-hours">{r.openNow}h</div><div className="text-[10.5px] font-bold mt-0.5" style={{ color: 'var(--text-subtle)' }}>open</div></>
                : day.finished ? <><div className="text-[18px] font-black leading-none" style={{ color: 'var(--text-muted)' }}>Done</div><div className="text-[10.5px] font-bold mt-0.5" style={{ color: 'var(--text-subtle)' }}>for today</div></>
                : <><div className="text-[24px] font-black leading-none" style={{ color: 'var(--brand-green)', letterSpacing: '-0.02em' }} data-testid="court-full">Full</div><div className="text-[10.5px] font-bold mt-0.5" style={{ color: 'var(--text-subtle)' }}>from now</div></>}
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="text-[14px] font-extrabold truncate" style={{ color: 'var(--text-primary)' }}>{r.name}</span>
                {r.pct !== null && <span className="text-[11.5px] font-semibold whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{r.pct}% booked today</span>}
              </div>
              <div aria-hidden className="grid gap-[2px] mt-1.5" style={{ gridTemplateColumns: `repeat(${Math.max(n, 1)}, minmax(0,1fr))` }}>
                {r.cells.map(c => <i key={c.hour} style={{ height: 20, borderRadius: 4, display: 'block', ...cellStyle(c) }} />)}
              </div>
              <div className="text-[12px] mt-1.5" style={{ color: 'var(--text-muted)' }}>{done ? 'Not on sale today' : open ?? (day.finished ? 'Finished for today' : 'Nothing left to sell')}</div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
