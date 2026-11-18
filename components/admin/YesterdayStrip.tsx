import { formatPrice, type CurrencyCode } from '@/lib/currency'
import type { Briefing } from '@/lib/briefing'

const money = (n: number, c: CurrencyCode) => formatPrice(n, c).replace(/\.00$/, '')
const card = { background: 'linear-gradient(135deg, var(--brand-primary-muted), var(--bg-surface))', border: '1px solid var(--brand-primary)' } as const

// Yesterday on one line, at the top of Today: takings, bookings and how full the courts were, each against the same
// weekday last week. The jobs (fill, remind) are in Needs attention below, so nothing is shown twice.
function Delta({ diff, money: isMoney, currency }: { diff: number | null; money: boolean; currency: CurrencyCode }) {
  if (diff === null || diff === 0) return null
  const up = diff > 0
  const n = Math.abs(diff)
  return <span style={{ color: up ? 'var(--success, #35c27a)' : 'var(--brand-crimson)' }} className="font-bold"> {up ? '▲' : '▼'} {isMoney ? money(n, currency) : n}</span>
}

export default function YesterdayStrip({ b, currency, weekday, label, brandNew, hero }: { b: Briefing; currency: CurrencyCode; weekday: string; label: string; brandNew?: boolean; hero?: boolean }) {
  const compared = b.takingsDiff !== null
  // hero: the same line, sitting inside the blue card at the top of Today instead of in a card of its own
  return (
    <section className={hero ? 'yesterday-hero' : 'rounded-2xl mt-4 p-4'} style={hero ? undefined : card} data-testid="yesterday-strip">
      {b.bookings === 0 && brandNew ? (
        <>
          <div className="text-[15px] font-extrabold" style={{ color: 'var(--text-primary)' }} data-testid="yesterday-new">Your first bookings will show up here</div>
          <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Each morning this shows how yesterday went: takings, bookings and how full the courts were.</div>
        </>
      ) : b.bookings === 0 ? (
        <>
          <div className="text-[15px] font-extrabold" style={{ color: 'var(--text-primary)' }}>Yesterday was quiet</div>
          <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>No bookings on {label.replace(/^Yesterday, /, '')}</div>
        </>
      ) : (
        <>
          <div className="text-[15px] font-extrabold tabular-nums" style={{ color: 'var(--text-primary)' }}>
            {money(b.takings, currency)}<Delta diff={b.takingsDiff} money currency={currency} />
            <span style={{ color: 'var(--text-subtle)' }}> · </span>
            {b.bookings} {b.bookings === 1 ? 'booking' : 'bookings'}<Delta diff={b.bookingsDiff} money={false} currency={currency} />
            {b.fillPct !== null && <><span style={{ color: 'var(--text-subtle)' }}> · </span>{b.fillPct}% booked</>}
          </div>
          <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}{compared ? `, against last ${weekday}` : ''}</div>
        </>
      )}
    </section>
  )
}
