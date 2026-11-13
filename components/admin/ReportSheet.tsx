import { format, parseISO } from 'date-fns'
import { formatPrice, type CurrencyCode } from '@/lib/currency'
import { describeChange, change, paymentLabel, type DateRange, type Summary } from '@/lib/report-rules'

const d = (s: string) => format(parseISO(s), 'd MMM yyyy')

// The one-page report that is printed or saved as a PDF. It is hidden on screen and shown only when printing
// (see the .report-sheet rules in globals.css), in fixed light colours so it prints the same whatever theme is on.
export default function ReportSheet({ clubName, range, prevRange, summary, prev, currency, preparedOn }: {
  clubName: string
  range: DateRange
  prevRange: DateRange
  summary: Summary
  prev: Summary
  currency: CurrencyCode
  preparedOn: string
}) {
  const money = (n: number) => formatPrice(n, currency)
  const max = Math.max(1, ...summary.byDay.map(x => x.revenue))
  const kpis = [
    { label: 'Revenue', value: money(summary.revenue), c: change(summary.revenue, prev.revenue), good: true },
    { label: 'Bookings', value: String(summary.bookings), c: change(summary.bookings, prev.bookings), good: true },
    { label: 'Average booking', value: money(summary.average), c: change(summary.average, prev.average), good: true },
    { label: 'Cancelled (estimate)', value: money(summary.cancelled), c: change(summary.cancelled, prev.cancelled), good: false },
  ]
  const share = (n: number) => (summary.revenue > 0 ? `${Math.round((n / summary.revenue) * 100)}%` : '–')
  return (
    <div className="report-sheet" data-testid="report-sheet">
      <h1>{clubName}</h1>
      <p className="rs-meta">Revenue report · {d(range.from)} to {d(range.to)} · prepared {d(preparedOn)}</p>
      <div className="rs-kpis">
        {kpis.map(k => (
          <div key={k.label}>
            <small>{k.label}</small>
            <b>{k.value}</b>
            <em className={k.c.dir === 'up' ? (k.good ? 'good' : 'bad') : k.c.dir === 'down' ? (k.good ? 'bad' : 'good') : ''}>{describeChange(k.c)}</em>
          </div>
        ))}
      </div>
      <p className="rs-meta" style={{ marginTop: 0 }}>Compared with {d(prevRange.from)} to {d(prevRange.to)}.</p>

      <h2>Revenue by day</h2>
      <div className="rs-bars" aria-hidden>
        {summary.byDay.map(x => <i key={x.date} style={{ height: `${Math.max(2, (x.revenue / max) * 100)}%` }} />)}
      </div>
      <div className="rs-axis"><span>{d(range.from)}</span><span>{d(range.to)}</span></div>
      {summary.bestWeekday && <p className="rs-meta">Strongest day of the week: {summary.bestWeekday.name} ({money(summary.bestWeekday.revenue)}).</p>}

      <div className="rs-two">
        <div>
          <h2>By court</h2>
          <table><thead><tr><th>Court</th><th>Bookings</th><th>Revenue</th><th>Share</th></tr></thead>
            <tbody>{summary.byCourt.map(c => <tr key={c.name}><td>{c.name}</td><td>{c.bookings}</td><td>{money(c.revenue)}</td><td>{share(c.revenue)}</td></tr>)}</tbody></table>
        </div>
        <div>
          <h2>By payment method</h2>
          <table><thead><tr><th>Paid with</th><th>Bookings</th><th>Revenue</th></tr></thead>
            <tbody>{summary.byMethod.map(m => <tr key={m.method}><td>{paymentLabel(m.method)}</td><td>{m.bookings}</td><td>{money(m.revenue)}</td></tr>)}</tbody></table>
        </div>
      </div>

      {summary.topMembers.length > 0 && (
        <>
          <h2>Top members by spend</h2>
          <table><thead><tr><th>Member</th><th>Plan</th><th>Bookings</th><th>Spent</th></tr></thead>
            <tbody>{summary.topMembers.map(m => <tr key={m.name + m.plan}><td>{m.name}</td><td>{m.plan}</td><td>{m.bookings}</td><td>{money(m.spent)}</td></tr>)}</tbody></table>
        </>
      )}

      <p className="rs-foot">
        All amounts in {currency.toUpperCase()}. Revenue counts confirmed and completed bookings. &ldquo;Cancelled&rdquo; is an estimate: the price of bookings paid by card and later cancelled in this period. Card refunds are made in Stripe and are not listed here. Source: PadelClub bookings.
      </p>
    </div>
  )
}
