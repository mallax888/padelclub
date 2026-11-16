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

export default function YesterdayStrip({ b, currency, weekday, label }: { b: Briefing; currency: CurrencyCode; weekday: string; label: string }) {
  const compared = b.takingsDiff !== null
  return (
    <section className="rounded-2xl mt-4 p-4" style={card} data-testid="yesterday-strip">
      {b.bookings === 0 ? (
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
