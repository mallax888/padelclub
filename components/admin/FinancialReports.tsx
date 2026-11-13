'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { format, parseISO } from 'date-fns'
import { localDateStr } from '@/lib/utils'
import { currencyForVenueSlug, formatPrice } from '@/lib/currency'
import { getVenue } from '@/lib/venues'
import {
  PERIOD_OPTIONS, change, dailyCsv, describeChange, detailedCsv, paymentLabel, periodRange, previousRange, summarise, weekdayName,
  type Change, type PeriodKey, type ReportRow,
} from '@/lib/report-rules'
import type { FinancialCreditTx } from '@/lib/analytics'
import ReportSheet from '@/components/admin/ReportSheet'

const card = { background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' } as const
const short = (s: string) => format(parseISO(s), 'd MMM')
const long = (s: string) => format(parseISO(s), 'd MMM yyyy')

function save(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const a = document.createElement('a')
  a.href = url; a.download = name
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function Delta({ c, goodWhenUp = true }: { c: Change; goodWhenUp?: boolean }) {
  const good = c.dir === 'up' ? goodWhenUp : c.dir === 'down' ? !goodWhenUp : null
  return (
    <span className="text-[11px] font-bold" style={{ color: good === null ? 'var(--text-subtle)' : good ? 'var(--brand-green)' : 'var(--brand-crimson)' }}>
      {describeChange(c)}
    </span>
  )
}

function Bars({ title, items, money }: { title: string; items: { name: string; amount: number; bookings: number }[]; money: (n: number) => string }) {
  const max = Math.max(1, ...items.map(i => i.amount))
  return (
    <div className="rounded-2xl p-4" style={card}>
      <div className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>{title}</div>
      {items.length === 0 ? <div className="text-sm py-4 text-center" style={{ color: 'var(--text-subtle)' }}>Nothing in this period yet.</div> : (
        <div className="space-y-3">
          {items.map(i => (
            <div key={i.name}>
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <span className="text-sm font-medium min-w-0 truncate" style={{ color: 'var(--text-primary)' }}>{i.name}</span>
                <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>{money(i.amount)} · {i.bookings} {i.bookings === 1 ? 'booking' : 'bookings'}</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-raised)' }}>
                <div className="h-full rounded-full" style={{ width: `${Math.max(2, (i.amount / max) * 100)}%`, background: 'var(--brand-primary)' }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function FinancialReports({
  rows,
  creditTransactions,
  todayStr,
  venueSlug,
}: {
  rows: ReportRow[]
  creditTransactions: FinancialCreditTx[]
  // "Today" as the page already has it (matches the server's first render; see AdminDashboard).
  todayStr?: string
  venueSlug: string
}) {
  const [key, setKey] = useState<PeriodKey>('30')
  // The printable sheet goes straight into <body> so printing can show it alone; only once the page is in the browser.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const today = todayStr ?? localDateStr()
  const range = periodRange(key, today), prevRange = previousRange(range)
  const summary = summarise(rows, range), prev = summarise(rows, prevRange)
  const currency = currencyForVenueSlug(venueSlug)
  const club = venueSlug ? getVenue(venueSlug) : null
  const clubName = club?.name ?? 'Your club'
  const money = (n: number) => formatPrice(n, currency)

  const credits = (() => {
    const inRange = creditTransactions.filter(t => { const day = t.created_at.slice(0, 10); return day >= range.from && day <= range.to })
    const sum = (type: string) => inRange.filter(t => t.type === type).reduce((s, t) => s + Math.abs(t.amount), 0)
    return { issued: sum('purchase'), used: sum('used'), refunded: sum('refund') }
  })()

  const best = summary.byDay.reduce((m, x) => (x.revenue > m.revenue ? x : m), summary.byDay[0] ?? { date: '', revenue: 0, bookings: 0 })
  const max = Math.max(1, ...summary.byDay.map(x => x.revenue))
  const mid = summary.byDay[Math.floor(summary.byDay.length / 2)]
  const file = (what: string) => `padelclub-${what}-${clubName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${range.from}-to-${range.to}.csv`
  const kpis = [
    { id: 'revenue', label: 'Revenue', value: money(summary.revenue), c: change(summary.revenue, prev.revenue), goodWhenUp: true },
    { id: 'bookings', label: 'Bookings', value: String(summary.bookings), c: change(summary.bookings, prev.bookings), goodWhenUp: true },
    { id: 'average', label: 'Average booking', value: money(summary.average), c: change(summary.average, prev.average), goodWhenUp: true },
    { id: 'cancelled', label: 'Cancelled (estimate)', value: money(summary.cancelled), c: change(summary.cancelled, prev.cancelled), goodWhenUp: false },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg p-1" role="group" aria-label="Period" style={{ background: 'var(--bg-raised)' }}>
          {PERIOD_OPTIONS.map(p => (
            <button key={p.key} type="button" aria-pressed={key === p.key} data-testid={`report-period-${p.key}`} onClick={() => setKey(p.key)}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{ background: key === p.key ? 'var(--brand-primary)' : 'transparent', color: key === p.key ? 'var(--brand-primary-on)' : 'var(--text-muted)' }}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-sm" data-testid="report-csv-bookings" disabled={summary.bookings === 0}
            onClick={() => save(file('bookings'), detailedCsv(rows, range, { clubName, venueSlug, currency }))}>Export bookings (CSV)</button>
          <button className="btn btn-sm" data-testid="report-csv-daily" onClick={() => save(file('daily-totals'), dailyCsv(summary, { currency }))}>Totals by day (CSV)</button>
          <button className="btn btn-primary btn-sm" data-testid="report-print" onClick={() => window.print()}>Print or save as PDF</button>
        </div>
      </div>

      <p className="text-xs" data-testid="report-range" style={{ color: 'var(--text-subtle)' }}>
        {clubName} · {long(range.from)} to {long(range.to)} · compared with {short(prevRange.from)} to {long(prevRange.to)}
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map(k => (
          <div key={k.id} className="rounded-2xl p-4" data-testid={`report-kpi-${k.id}`} style={card}>
            <div className="text-xs mb-1" style={{ color: 'var(--text-subtle)' }}>{k.label}</div>
            <div className="text-xl font-semibold" style={{ color: k.id === 'cancelled' ? 'var(--brand-crimson)' : 'var(--text-primary)' }}>{k.value}</div>
            <div className="mt-0.5"><Delta c={k.c} goodWhenUp={k.goodWhenUp} /></div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl p-4" style={card}>
        <div className="flex items-baseline justify-between gap-2 mb-3">
          <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Revenue by day</div>
          {summary.bestWeekday && <div className="text-xs" style={{ color: 'var(--text-muted)' }} data-testid="report-best-weekday">Strongest day: {summary.bestWeekday.name}</div>}
        </div>
        {summary.revenue === 0 ? (
          <div className="text-sm text-center py-8" style={{ color: 'var(--text-subtle)' }}>No revenue in this period yet.</div>
        ) : (
          <>
            <div className="flex items-end gap-[3px] h-32 border-b" role="img" data-testid="report-chart" style={{ borderColor: 'var(--border)' }}
              aria-label={`Revenue for each day from ${long(range.from)} to ${long(range.to)}. The best day was ${best.date ? `${weekdayName(best.date)} ${short(best.date)}` : 'none'} with ${money(best.revenue)}.`}>
              {summary.byDay.map(x => (
                <div key={x.date} className="flex-1 rounded-t-sm" title={`${weekdayName(x.date).slice(0, 3)} ${short(x.date)}: ${money(x.revenue)} · ${x.bookings} ${x.bookings === 1 ? 'booking' : 'bookings'}`}
                  style={{ height: `${x.revenue > 0 ? Math.max(3, (x.revenue / max) * 100) : 1}%`, background: x.date === best.date ? 'var(--brand-yellow)' : 'var(--brand-primary)', opacity: x.revenue > 0 ? 1 : 0.35 }} />
              ))}
            </div>
            <div className="flex justify-between text-[10px] mt-1.5" style={{ color: 'var(--text-subtle)' }}>
              <span>{short(range.from)}</span>{mid && summary.byDay.length > 6 && <span>{short(mid.date)}</span>}<span>{short(range.to)}</span>
            </div>
            <div className="text-[11px] mt-1" style={{ color: 'var(--text-subtle)' }}>
              <span aria-hidden style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: 'var(--brand-yellow)', marginRight: 5 }} />
              Best day: {weekdayName(best.date).slice(0, 3)} {short(best.date)}, {money(best.revenue)}
            </div>
          </>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Bars title="By court" money={money} items={summary.byCourt.map(c => ({ name: c.name, amount: c.revenue, bookings: c.bookings }))} />
        <Bars title="By payment method" money={money} items={summary.byMethod.map(m => ({ name: paymentLabel(m.method), amount: m.revenue, bookings: m.bookings }))} />
      </div>

      {summary.topMembers.length > 0 && (
        <div className="rounded-2xl p-4" data-testid="report-top-members" style={card}>
          <div className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Top members by spend</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead><tr className="text-[11px]" style={{ color: 'var(--text-subtle)' }}>
                <th className="text-left font-semibold pb-1.5">Member</th><th className="text-left font-semibold pb-1.5 px-2">Plan</th>
                <th className="text-right font-semibold pb-1.5 px-2">Bookings</th><th className="text-right font-semibold pb-1.5">Spent</th>
              </tr></thead>
              <tbody>
                {summary.topMembers.map(m => (
                  <tr key={m.name + m.plan} style={{ color: 'var(--text-primary)', borderTop: '1px solid var(--border)' }}>
                    <td className="py-1.5 font-medium">{m.name}</td><td className="py-1.5 px-2" style={{ color: 'var(--text-muted)' }}>{m.plan || '—'}</td>
                    <td className="py-1.5 px-2 text-right">{m.bookings}</td><td className="py-1.5 text-right font-semibold">{money(m.spent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="rounded-2xl px-4 py-3 text-sm" data-testid="report-credits" style={{ ...card, color: 'var(--text-muted)' }}>
        <b style={{ color: 'var(--text-primary)' }}>Session credits</b> in this period: {credits.issued} issued · {credits.used} used · {credits.refunded} refunded
      </div>

      <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>
        &ldquo;Cancelled&rdquo; is an estimate: the price of bookings paid by card and later cancelled in this period, whether a full refund or a partial credit was actually given. Card refunds are made in Stripe and are not recorded here, so every export says the same.
      </div>

      {mounted && createPortal(
        <ReportSheet clubName={clubName} range={range} prevRange={prevRange} summary={summary} prev={prev} currency={currency} preparedOn={today} />,
        document.body,
      )}
    </div>
  )
}
