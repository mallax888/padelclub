import { VENUES } from '@/lib/venues'
import { currencyForRegion, formatPrice } from '@/lib/currency'
import { fmtClock } from '@/lib/clock'
import { buildPastHistory, type PastChip, type PastOwn, type PastShare } from '@/lib/past-history'

const card = { background: 'var(--bg-surface)', border: '1px solid var(--border)' } as const
const TICKET = 'linear-gradient(160deg, #2c5fc4, #1d3f8d)'
const dateParts = (date: string) => {
  const d = new Date(date + 'T12:00:00Z')
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-NZ', { timeZone: 'UTC', ...o }).format(d)
  return { weekday: f({ weekday: 'short' }).toUpperCase(), day: f({ day: 'numeric' }), month: f({ month: 'short' }).toUpperCase() }
}
const currencyOf = (slug: string | null) => currencyForRegion(VENUES.find(v => v.slug === slug)?.region)

const chipStyle = (c: PastChip) =>
  c.tone === 'paid' ? { background: 'var(--brand-green-muted)', color: 'var(--go-text)' }
  : c.tone === 'cancelled' ? { background: 'var(--brand-primary-muted)', color: 'var(--brand-primary-text)' }
  : { background: 'var(--bg-raised)', color: 'var(--text-muted)' }

// Every finished game, newest first, grouped by month: the courts you booked and the games you joined, each saying how it ended.
export default function PastHistory({ own, joinedPaid, unpaid, year }: { own: PastOwn[]; joinedPaid: PastShare[]; unpaid: PastShare[]; year: string }) {
  const months = buildPastHistory({ own, joinedPaid, unpaid, year })
  if (months.length === 0) {
    return <div className="rounded-2xl text-center py-8 text-sm" style={{ ...card, color: 'var(--text-muted)' }}>Nothing here yet.</div>
  }
  // The money tile is for the most recent month you actually paid in.
  const first = months.find(m => m.paid > 0)
  const firstCurrency = first?.items.find(i => i.paid > 0)?.venueSlug ?? null
  const oneCurrency = new Set((first?.items ?? []).filter(i => i.paid > 0).map(i => currencyOf(i.venueSlug))).size <= 1
  return (
    <div data-testid="past-history">
      {first && oneCurrency && (
        <div className="rounded-[20px] px-5 py-4 mb-2 text-white" style={{ background: TICKET }} data-testid="past-paid-total">
          <span className="block text-[12px]" style={{ color: '#cfe0ff' }}>You paid in {first.label}</span>
          <b className="block text-[28px] font-black leading-tight">{formatPrice(first.paid, currencyOf(firstCurrency))}</b>
          <span className="block text-[12px]" style={{ color: '#cfe0ff' }}>{first.games} {first.games === 1 ? 'game' : 'games'}</span>
        </div>
      )}
      {months.map(m => (
        <section key={m.key} data-testid="past-month">
          <h3 className="text-[10.5px] font-extrabold uppercase mt-5 mb-2 px-0.5" style={{ letterSpacing: '0.14em', color: 'var(--text-subtle)' }}>{m.label}</h3>
          <div className="space-y-2.5">
            {m.items.map(it => {
              const d = dateParts(it.date)
              return (
                <div key={it.key} className="flex items-center gap-3 rounded-2xl px-3.5 py-3" style={card} data-testid="past-row">
                  <span className="shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center leading-none" style={{ background: 'var(--bg-raised)', color: 'var(--text-muted)' }} aria-hidden>
                    <span className="text-[9px] font-extrabold">{d.weekday}</span>
                    <b className="text-[18px] font-black my-0.5" style={{ color: 'var(--text-primary)' }}>{d.day}</b>
                    <span className="text-[9px] font-extrabold">{d.month}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>{it.court} · {fmtClock(it.startTime)}</span>
                    <span className="block text-[11.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{it.note}</span>
                  </span>
                  <span className="shrink-0 text-[11px] font-extrabold rounded-full px-2.5 py-1 whitespace-nowrap" style={chipStyle(it.chip)} data-testid="past-chip">
                    {it.chip.label}{it.chip.amount !== undefined ? ` ${formatPrice(it.chip.amount, currencyOf(it.venueSlug))}` : ''}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
