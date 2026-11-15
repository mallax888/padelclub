// The Excel version of the report: a first sheet laid out like the PDF (figures, the revenue chart, the tables), the raw
// Bookings data and a By day sheet, formatted so it opens looking finished. Built as plain data here (no browser, no file) and written to a file by the Reports tab.
import type { CurrencyCode } from '@/lib/currency'
import { bookedAtTime, bookedOnDay, change, describeChange, niceDate, paymentLabel, rawBookings, statusLabel, weekdayName, RAW_HEADER, type DateRange, type ReportRow, type Summary } from '@/lib/report-rules'
import type { ChartPicture } from '@/lib/report-chart'

type Cell = { value: string | number | Date | null; type?: typeof Number | typeof Date | typeof String; format?: string; fontWeight?: 'bold'; fontSize?: number; color?: string; backgroundColor?: string; align?: 'left' | 'center' | 'right'; alignVertical?: 'top' | 'center' | 'bottom'; columnSpan?: number; height?: number; wrap?: boolean; borderColor?: string; borderStyle?: string }
export type Sheet = { data: Cell[][]; sheet: string; columns: { width: number }[]; stickyRowsCount?: number; showGridLines?: boolean; orientation?: 'portrait' | 'landscape'; images?: { content: ArrayBuffer; contentType: string; width: number; height: number; dpi: number; anchor: { row: number; column: number }; offsetY?: number; title?: string }[] }

const NAVY = '#1F3A5F'
const money = (currency: CurrencyCode): string => (currency === 'zar' ? '"R "#,##0.00' : '"$"#,##0.00')
const head = (text: string, align: Cell['align'] = 'left'): Cell => ({ value: text, fontWeight: 'bold', color: '#FFFFFF', backgroundColor: NAVY, align })
const bold = (text: string): Cell => ({ value: text, fontWeight: 'bold' })
const text = (v: string, extra: Partial<Cell> = {}): Cell => ({ value: v, ...extra })
const num = (n: number, extra: Partial<Cell> = {}): Cell => ({ value: n, type: Number, align: 'right', ...extra })
const cash = (n: number, currency: CurrencyCode, extra: Partial<Cell> = {}): Cell => num(n, { format: money(currency), ...extra })
// Midnight UTC, so the day never shifts with the viewer's timezone.
const day = (ymd: string): Cell => { const [y, m, d] = ymd.split('-').map(Number); return { value: new Date(Date.UTC(y, m - 1, d)), type: Date, format: 'd mmm yyyy', align: 'left' } }


const INK = '#1B2433', MUTED = '#5B6877', LINE = '#D5DCE5', BAND = '#F3F6FA', GOOD = '#0F8A5F', BAD = '#C23B3B'
const A_SUB = { color: MUTED, fontSize: 10 } as const
const tile = (c: Partial<Cell>): Cell => ({ borderColor: LINE, borderStyle: 'thin', backgroundColor: '#FFFFFF', columnSpan: 2, ...c, value: c.value ?? null } as Cell)
const pad: Cell = { value: null }
// A cell hidden under a merged one must be a real null.
const hid = null as unknown as Cell

export function buildWorkbook(o: {
  clubName: string; venueSlug: string; currency: CurrencyCode; range: DateRange; prevRange: DateRange
  rows: ReportRow[]; summary: Summary; prev: Summary; preparedOn: string; chart?: ChartPicture | null
}): Sheet[] {
  const { currency, summary, prev } = o
  const cur = (n: number) => `${currency === 'zar' ? 'R' : '$'}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const best = summary.byDay.reduce((m, x) => (x.revenue > m.revenue ? x : m), summary.byDay[0] ?? { date: '', revenue: 0, bookings: 0 })

  // ---- Report (the PDF, as a sheet): 8 columns, tiles two columns wide
  const kpi = (label: string, now: number, before: number, isMoney: boolean, goodWhenUp: boolean) => {
    const c = change(now, before)
    const good = c.dir === 'flat' || c.dir === 'none' ? null : (c.dir === 'up' || c.dir === 'new') === goodWhenUp
    return {
      label, value: isMoney ? cur(now) : String(now), change: describeChange(c, isMoney ? cur(before) : String(before)),
      color: good === null ? MUTED : good ? GOOD : BAD,
    }
  }
  const tiles = [
    kpi('Revenue', summary.revenue, prev.revenue, true, true), kpi('Bookings', summary.bookings, prev.bookings, false, true),
    kpi('Average booking', summary.average, prev.average, true, true), kpi('Cancelled (estimate)', summary.cancelled, prev.cancelled, true, false),
  ]
  const row8 = (cells: Cell[]): Cell[] => cells
  const tileRow = (pick: (t: (typeof tiles)[number]) => Partial<Cell>): Cell[] => tiles.flatMap(t => [tile(pick(t)), hid])
  const section = (title: string, span = 8): Cell[] => [{ value: title.toUpperCase(), fontWeight: 'bold', color: INK, fontSize: 11, columnSpan: span }, ...Array.from({ length: span - 1 }, () => hid)]
  const th = (t: string, align: Cell['align'] = 'left'): Cell => ({ value: t, fontWeight: 'bold', color: MUTED, align, borderColor: LINE, borderStyle: 'thin' })
  const td = (c: Cell): Cell => ({ ...c, borderColor: LINE, borderStyle: 'thin' })

  const CHART_ROWS = 10
  const report: Cell[][] = [
    [{ value: o.clubName, fontWeight: 'bold', fontSize: 20, color: INK, columnSpan: 8, height: 30 }, ...Array.from({ length: 7 }, () => hid)],
    [{ value: `Revenue report · ${niceDate(o.range.from)} to ${niceDate(o.range.to)} · prepared ${niceDate(o.preparedOn)}`, ...A_SUB, columnSpan: 8 }, ...Array.from({ length: 7 }, () => hid)],
    [pad],
    tileRow(t => ({ value: t.label, ...A_SUB, height: 18, alignVertical: 'bottom' })),
    tileRow(t => ({ value: t.value, fontWeight: 'bold', fontSize: 20, color: INK, height: 30, alignVertical: 'center' })),
    tileRow(t => ({ value: t.change, fontWeight: 'bold', fontSize: 10, color: t.color, height: 18, alignVertical: 'top' })),
    [{ value: `Compared with ${niceDate(o.prevRange.from)} to ${niceDate(o.prevRange.to)}.`, ...A_SUB, columnSpan: 8 }, ...Array.from({ length: 7 }, () => hid)],
    [pad],
    section('Revenue by day'),
  ]
  const chartRow = report.length + 1 // sheet rows are 1-based
  if (o.chart) for (let i = 0; i < CHART_ROWS; i++) report.push([{ value: null, height: 16 }])
  report.push(
    [{ value: best.date ? `Strongest day: ${weekdayName(best.date)} ${niceDate(best.date)} (${cur(best.revenue)}). The best day is shown in yellow.` : 'No bookings in this period.', ...A_SUB, columnSpan: 8 }, ...Array.from({ length: 7 }, () => hid)],
    [pad],
  )
  // By court (A-D) beside By payment method (F-H)
  const courts = summary.byCourt, methods = summary.byMethod
  report.push(
    [{ value: 'BY COURT', fontWeight: 'bold', color: INK, fontSize: 11, columnSpan: 4 }, hid, hid, hid, pad, { value: 'BY PAYMENT METHOD', fontWeight: 'bold', color: INK, fontSize: 11, columnSpan: 3 }, hid, hid],
    [th('Court'), th('Bookings', 'right'), th('Revenue', 'right'), th('Share', 'right'), pad, th('Paid with'), th('Bookings', 'right'), th('Revenue', 'right')],
  )
  for (let i = 0; i < Math.max(courts.length, methods.length); i++) {
    const c = courts[i], m = methods[i]
    report.push(row8([
      c ? td(text(c.name)) : pad, c ? td(num(c.bookings)) : pad, c ? td(cash(c.revenue, currency)) : pad, c ? td(text(summary.revenue > 0 ? `${Math.round((c.revenue / summary.revenue) * 100)}%` : '', { align: 'right' })) : pad, pad,
      m ? td(text(paymentLabel(m.method))) : pad, m ? td(num(m.bookings)) : pad, m ? td(cash(m.revenue, currency)) : pad,
    ]))
  }
  report.push([pad], section('Top members by spend'), [th('Member'), th('Plan'), th('Bookings', 'right'), th('Spent', 'right')])
  for (const m of summary.topMembers) report.push([td(text(m.name)), td(text(m.plan)), td(num(m.bookings)), td(cash(m.spent, currency))])
  report.push([pad], [{ value: `All amounts in ${currency.toUpperCase()}. Revenue counts confirmed and completed bookings. "Cancelled" is an estimate: the price of bookings paid by card and later cancelled in this period, whether a full refund or a partial credit was actually given. Card refunds are made in Stripe and are not recorded here.`, ...A_SUB, wrap: true, alignVertical: 'top', columnSpan: 8, height: 44 }, ...Array.from({ length: 7 }, () => hid)])

  // ---- Bookings: the raw data, every booking in the period (cancelled too), banded, header frozen
  const all = rawBookings(o.rows, o.range)
  const earned = all.filter(b => b.status === 'confirmed' || b.status === 'completed')
  const bandOf = (i: number): Partial<Cell> => (i % 2 === 1 ? { backgroundColor: BAND } : {})
  const bookingRows: Cell[][] = [
    RAW_HEADER.map(h => head(h, ['Amount', 'Minutes'].includes(h) ? 'right' : 'left')),
    ...all.map((b, i) => {
      const bk = bandOf(i), booked = bookedOnDay(b.created_at, o.venueSlug), cancelled = b.status === 'cancelled'
      const t = (v: string, extra: Partial<Cell> = {}) => text(v, { ...bk, ...(cancelled ? { color: '#8A94A3' } : {}), ...extra })
      return [
        { ...day(b.date), ...bk, ...(cancelled ? { color: '#8A94A3' } : {}) }, t(weekdayName(b.date).slice(0, 3)), t(b.start_time?.slice(0, 5) ?? ''), t(b.end_time?.slice(0, 5) ?? ''),
        b.duration_minutes != null ? num(b.duration_minutes, bk) : t(''), t(o.clubName), t(b.court_name), t(b.member_name), t(b.member_email ?? ''), t(b.plan),
        t(statusLabel(b.status), { fontWeight: cancelled ? 'bold' : undefined, color: cancelled ? BAD : undefined }), cash(b.amount || 0, currency, { ...bk, ...(cancelled ? { color: '#8A94A3' } : {}) }),
        t(currency.toUpperCase()), t(paymentLabel(b.payment_method)), booked ? { ...day(booked), ...bk } : t('', bk), t(bookedAtTime(b.created_at, o.venueSlug)), t(b.stripe_payment_id ?? ''), t(b.id ?? ''),
      ]
    }),
    [text('Total (confirmed and completed)', { fontWeight: 'bold', columnSpan: 11 }), ...Array.from({ length: 10 }, () => hid), cash(earned.reduce((s, b) => s + (b.amount || 0), 0), currency, { fontWeight: 'bold' })],
  ]

  // ---- By day
  const maxDay = Math.max(1, ...summary.byDay.map(d => d.revenue))
  const dayRows: Cell[][] = [
    [head('Date'), head('Day'), head('Bookings', 'right'), head('Revenue', 'right'), head('')],
    ...summary.byDay.map((d, i) => [{ ...day(d.date), ...bandOf(i) }, text(weekdayName(d.date).slice(0, 3), bandOf(i)), num(d.bookings, bandOf(i)), cash(d.revenue, currency, bandOf(i)),
      text('█'.repeat(Math.round((d.revenue / maxDay) * 28)), { color: d.date === best.date ? '#E6B800' : '#2F6FD0', ...bandOf(i) })]),
    [text('Total', { fontWeight: 'bold' }), text(''), num(summary.byDay.reduce((s, d) => s + d.bookings, 0), { fontWeight: 'bold' }), cash(summary.byDay.reduce((s, d) => s + d.revenue, 0), currency, { fontWeight: 'bold' })],
  ]

  const reportSheet: Sheet = {
    sheet: 'Report', data: report, showGridLines: false, orientation: 'landscape',
    columns: [{ width: 24 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 3 }, { width: 24 }, { width: 14 }, { width: 14 }],
  }
  if (o.chart) reportSheet.images = [{ content: o.chart.content, contentType: o.chart.contentType, width: o.chart.width, height: o.chart.height, dpi: 96, anchor: { row: chartRow + 1, column: 1 }, offsetY: 2, title: 'Revenue by day' }]
  return [
    reportSheet,
    { sheet: 'Bookings', data: bookingRows, stickyRowsCount: 1, columns: [{ width: 13 }, { width: 6 }, { width: 8 }, { width: 8 }, { width: 9 }, { width: 24 }, { width: 11 }, { width: 24 }, { width: 30 }, { width: 14 }, { width: 11 }, { width: 13 }, { width: 9 }, { width: 20 }, { width: 13 }, { width: 10 }, { width: 28 }, { width: 36 }] },
    { sheet: 'By day', data: dayRows, stickyRowsCount: 1, columns: [{ width: 13 }, { width: 6 }, { width: 11 }, { width: 14 }, { width: 34 }] },
  ]
}
