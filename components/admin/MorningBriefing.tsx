import Link from 'next/link'
import { formatPrice, type CurrencyCode } from '@/lib/currency'
import { describeDiff, gapText, type Briefing } from '@/lib/briefing'

const card = { background: 'linear-gradient(135deg, var(--brand-primary-muted), var(--bg-surface))', border: '1px solid var(--brand-primary)' } as const
const money = (n: number, c: CurrencyCode) => formatPrice(n, c).replace(/\.00$/, '')
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

// Yesterday at a glance, at the top of Today, with the same things the morning message carries. The buttons open
// the screens where each job is done.
export default function MorningBriefing({ b, currency, weekday, yesterdayLabel, venueSlug }: { b: Briefing; currency: CurrencyCode; weekday: string; yesterdayLabel: string; venueSlug: string }) {
  const q = `venue=${encodeURIComponent(venueSlug)}`
  const diffMoney = describeDiff(b.takingsDiff, weekday, true, currency)
  const diffCount = describeDiff(b.bookingsDiff, weekday, false, currency)
  const rows: { key: string; title: string; text: string; cta: string; href: string }[] = []
  if (b.emptyPrimeHours > 0) rows.push({ key: 'empty', title: `${plural(b.emptyPrimeHours, 'prime court-hour is', 'prime court-hours are')} empty today`, text: b.bestGap ? `Biggest gap: ${gapText(b.bestGap)}` : 'In the busy times', cta: 'Fill them', href: `/admin?tab=analytics&${q}` })
  if (b.overdueCount > 0) rows.push({ key: 'overdue', title: `${plural(b.overdueCount, 'share is', 'shares are')} overdue${b.overdueTotal !== null ? ` · ${money(b.overdueTotal, currency)}` : ''}`, text: 'The friend who owes it, and the person who booked', cta: 'Remind both', href: `/admin?tab=analytics&${q}` })
  if (b.newPlayers > 0) rows.push({ key: 'new', title: `${plural(b.newPlayers, 'new player', 'new players')} joined yesterday`, text: 'Have a look at who they are', cta: 'See players', href: '/players' })

  return (
    <section className="rounded-[20px] mt-4 px-4 py-4" style={card} data-testid="morning-briefing">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-extrabold" style={{ color: 'var(--text-primary)' }}>Morning briefing</h2>
        <span className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>{yesterdayLabel}</span>
      </div>
      <div className="grid grid-cols-3 gap-3 mt-3">
        {[
          ['Yesterday\'s takings', money(b.takings, currency), diffMoney],
          ['Bookings', String(b.bookings), diffCount],
          ['Courts booked', b.fillPct === null ? '–' : `${b.fillPct}%`, b.fillPct === null ? 'Closed yesterday' : 'of the hours you could sell'],
        ].map(([k, v, note]) => (
          <div key={k} className="rounded-xl px-3 py-2.5" style={{ background: 'var(--bg-raised)' }}>
            <div className="text-[10.5px] font-bold" style={{ color: 'var(--text-subtle)' }}>{k}</div>
            <div className="text-[20px] leading-tight font-extrabold mt-0.5 tabular-nums" style={{ color: 'var(--text-primary)' }}>{v}</div>
            <div className="text-[10.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{note}</div>
          </div>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="text-[13px] mt-3" style={{ color: 'var(--text-muted)' }} data-testid="briefing-clear">All clear: prime time today is booked and nothing needs chasing.</p>
      ) : (
        <div className="mt-3">
          {rows.map(r => (
            <div key={r.key} className="flex items-center gap-3 py-3" style={{ borderTop: '1px solid var(--border)' }} data-testid={`briefing-${r.key}`}>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-bold" style={{ color: 'var(--text-primary)' }}>{r.title}</span>
                <span className="block text-[11.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{r.text}</span>
              </span>
              <Link href={r.href} className="shrink-0 rounded-[10px] px-3.5 text-[12.5px] font-extrabold inline-flex items-center" style={{ minHeight: 38, background: 'var(--brand-primary)', color: 'var(--brand-primary-on)' }}>{r.cta}</Link>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
