// The Excel version of the report: a Summary sheet, the Bookings list and a By day sheet, laid out and formatted so
// it opens looking finished. Built as plain data here (no browser, no file) and written to a file by the Reports tab.
import type { CurrencyCode } from '@/lib/currency'
import { bookedOnDay, change, describeChange, niceDate, paymentLabel, weekdayName, type DateRange, type ReportRow, type Summary } from '@/lib/report-rules'

type Cell = { value: string | number | Date | null; type?: typeof Number | typeof Date | typeof String; format?: string; fontWeight?: 'bold'; fontSize?: number; color?: string; backgroundColor?: string; align?: 'left' | 'center' | 'right' }
export type Sheet = { data: Cell[][]; sheet: string; columns: { width: number }[]; stickyRowsCount?: number }

const NAVY = '#1F3A5F'
const money = (currency: CurrencyCode): string => (currency === 'zar' ? '"R "#,##0.00' : '"$"#,##0.00')
const head = (text: string, align: Cell['align'] = 'left'): Cell => ({ value: text, fontWeight: 'bold', color: '#FFFFFF', backgroundColor: NAVY, align })
const bold = (text: string): Cell => ({ value: text, fontWeight: 'bold' })
const text = (v: string, extra: Partial<Cell> = {}): Cell => ({ value: v, ...extra })
const num = (n: number, extra: Partial<Cell> = {}): Cell => ({ value: n, type: Number, align: 'right', ...extra })
const cash = (n: number, currency: CurrencyCode, extra: Partial<Cell> = {}): Cell => num(n, { format: money(currency), ...extra })
// Midnight UTC, so the day never shifts with the viewer's timezone.
const day = (ymd: string): Cell => { const [y, m, d] = ymd.split('-').map(Number); return { value: new Date(Date.UTC(y, m - 1, d)), type: Date, format: 'd mmm yyyy', align: 'left' } }

export function buildWorkbook(o: {
  clubName: string; venueSlug: string; currency: CurrencyCode; range: DateRange; prevRange: DateRange
  rows: ReportRow[]; summary: Summary; prev: Summary; preparedOn: string
}): Sheet[] {
  const { currency, summary, prev } = o
  const cur = (n: number) => `${currency === 'zar' ? 'R' : '$'}${n.toFixed(2)}`

  // ---- Summary
  const kpi = (label: string, cur_: number, prev_: number, isMoney: boolean): Cell[] => [
    bold(label), isMoney ? cash(cur_, currency) : num(cur_), isMoney ? cash(prev_, currency) : num(prev_),
    text(describeChange(change(cur_, prev_), isMoney ? cur(prev_) : String(prev_)), { align: 'right' }),
  ]
  const blank: Cell[] = [{ value: null }]
  const summaryRows: Cell[][] = [
    [text(o.clubName, { fontWeight: 'bold', fontSize: 16, color: NAVY })],
    [text(`Revenue report · ${niceDate(o.range.from)} to ${niceDate(o.range.to)} · prepared ${niceDate(o.preparedOn)}`, { color: '#5B6877' })],
    [text(`Compared with ${niceDate(o.prevRange.from)} to ${niceDate(o.prevRange.to)}`, { color: '#5B6877' })],
    blank,
    [head('Measure'), head('This period', 'right'), head('Previous period', 'right'), head('Change', 'right')],
    kpi('Revenue', summary.revenue, prev.revenue, true),
    kpi('Bookings', summary.bookings, prev.bookings, false),
    kpi('Average booking', summary.average, prev.average, true),
    kpi('Cancelled (estimate)', summary.cancelled, prev.cancelled, true),
    blank,
    [head('By court'), head('Bookings', 'right'), head('Revenue', 'right'), head('Share', 'right')],
    ...summary.byCourt.map(c => [text(c.name), num(c.bookings), cash(c.revenue, currency), text(summary.revenue > 0 ? `${Math.round((c.revenue / summary.revenue) * 100)}%` : '–', { align: 'right' })]),
    blank,
    [head('By payment method'), head('Bookings', 'right'), head('Revenue', 'right'), head('')],
    ...summary.byMethod.map(m => [text(paymentLabel(m.method)), num(m.bookings), cash(m.revenue, currency)]),
    blank,
    [head('Top members by spend'), head('Plan'), head('Bookings', 'right'), head('Spent', 'right')],
    ...summary.topMembers.map(m => [text(m.name), text(m.plan), num(m.bookings), cash(m.spent, currency)]),
    blank,
    [text(`All amounts in ${currency.toUpperCase()}. Revenue counts confirmed and completed bookings. "Cancelled" is an estimate: the price of bookings paid by card and later cancelled in this period. Card refunds are made in Stripe and are not listed here.`, { color: '#7A8696', fontSize: 9 })],
  ]

  // ---- Bookings
  const paid = o.rows.filter(b => (b.status === 'confirmed' || b.status === 'completed') && b.date >= o.range.from && b.date <= o.range.to)
    .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time))
  const bookingRows: Cell[][] = [
    [head('Date'), head('Day'), head('Time'), head('Club'), head('Court'), head('Member'), head('Plan'), head('Amount', 'right'), head('Paid with'), head('Status'), head('Booked on')],
    ...paid.map(b => {
      const booked = bookedOnDay(b.created_at, o.venueSlug)
      return [day(b.date), text(weekdayName(b.date).slice(0, 3)), text(b.start_time?.slice(0, 5) ?? ''), text(o.clubName), text(b.court_name), text(b.member_name), text(b.plan),
        cash(b.amount || 0, currency), text(paymentLabel(b.payment_method)), text(b.status), booked ? day(booked) : text('')]
    }),
    [text('Total', { fontWeight: 'bold' }), text(`${paid.length} bookings`), text(''), text(''), text(''), text(''), text(''), cash(paid.reduce((s, b) => s + (b.amount || 0), 0), currency, { fontWeight: 'bold' })],
  ]

  // ---- By day
  const dayRows: Cell[][] = [
    [head('Date'), head('Day'), head('Bookings', 'right'), head('Revenue', 'right')],
    ...summary.byDay.map(d => [day(d.date), text(weekdayName(d.date).slice(0, 3)), num(d.bookings), cash(d.revenue, currency)]),
    [text('Total', { fontWeight: 'bold' }), text(''), num(summary.byDay.reduce((s, d) => s + d.bookings, 0), { fontWeight: 'bold' }), cash(summary.byDay.reduce((s, d) => s + d.revenue, 0), currency, { fontWeight: 'bold' })],
  ]

  return [
    { sheet: 'Summary', data: summaryRows, columns: [{ width: 30 }, { width: 16 }, { width: 18 }, { width: 30 }] },
    { sheet: 'Bookings', data: bookingRows, stickyRowsCount: 1, columns: [{ width: 13 }, { width: 6 }, { width: 8 }, { width: 24 }, { width: 11 }, { width: 24 }, { width: 12 }, { width: 12 }, { width: 20 }, { width: 11 }, { width: 13 }] },
    { sheet: 'By day', data: dayRows, stickyRowsCount: 1, columns: [{ width: 13 }, { width: 6 }, { width: 11 }, { width: 14 }] },
  ]
}
