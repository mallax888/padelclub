'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { createPortal } from 'react-dom'
import { format, parseISO } from 'date-fns'
import { localDateStr } from '@/lib/utils'
import { currencyForVenueSlug, formatPrice } from '@/lib/currency'
import { getVenue } from '@/lib/venues'
import {
  PERIOD_OPTIONS, change, describeChange, detailedCsv, paymentLabel, periodRange, previousRange, summarise, weekdayName,
  type Change, type PeriodKey, type ReportRow,
} from '@/lib/report-rules'
import type { FinancialCreditTx } from '@/lib/analytics'
import ReportSheet from '@/components/admin/ReportSheet'
import { buildWorkbook } from '@/lib/report-xlsx'
import { drawRevenueChart } from '@/lib/report-chart'
import { NO_COSTS, breakevenView, dailyBreakeven, type RunningCosts } from '@/lib/running-costs'
import { CourtBadge } from '@/components/admin/ClubMap'
import MoneyBubble from '@/components/ui/MoneyBubble'

const short = (s: string) => format(parseISO(s), 'd MMM')
const long = (s: string) => format(parseISO(s), 'd MMM yyyy')

// The bar colours (see lib/money-colours.ts): green made money, grey below costs (no big red fills), blue still going.
const MADE = '#1f9a5f', BELOW = '#5b6470', GOING = '#2f6fd6'
const tile = { background: 'var(--board-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' } as const
const row = { background: 'var(--board-cell)' } as const
const label = { letterSpacing: '0.12em', color: 'var(--text-primary)' } as const

function save(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const a = document.createElement('a')
  a.href = url; a.download = name
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// A change since the period before, as a bubble. The arrow follows the manager's money: more money is a green up arrow, less is a red
// down arrow. So cancellations rising is a red down arrow ('outflow'); counts such as bookings stay blue ('count').
function Delta({ c, kind, previousText }: { c: Change; kind: 'money' | 'count' | 'outflow'; previousText?: string }) {
  const text = describeChange(c, previousText)
  if (c.dir !== 'up' && c.dir !== 'down') return <MoneyBubble kind="none" size={11} wrap testId="report-delta">{text}</MoneyBubble>
  const up = c.dir === 'up'
  const shown = kind === 'outflow' ? text.replace(up ? '▲' : '▼', up ? '▼' : '▲') : text
  const colour = kind === 'count' ? 'wait' : kind === 'money' ? (up ? 'gain' : 'loss') : (up ? 'loss' : 'gain')
  return <MoneyBubble kind={colour} size={11} wrap testId="report-delta">{shown}</MoneyBubble>
}

const Heading = ({ children }: { children: React.ReactNode }) => <h3 className="text-[11.5px] font-extrabold uppercase mb-3" style={label}>{children}</h3>

// One row per court or payment method: a tile, the money, the bookings, and a green bar for its share.
function Rows({ title, items, money, testId, className = '' }: { title: string; testId: string; className?: string; items: { key: string; tile: React.ReactNode; name?: string; amount: number; bookings: number }[]; money: (n: number) => string }) {
  const max = Math.max(1, ...items.map(i => i.amount))
  return (
    <div className={`rounded-[20px] p-5 ${className}`} style={tile} data-testid={testId}>
      <Heading>{title}</Heading>
      {items.length === 0 ? <div className="text-sm py-4 text-center" style={{ color: 'var(--text-primary)' }}>Nothing in this period yet.</div> : (
        <div className="space-y-2">
          {items.map(i => (
            <div key={i.key} className="flex items-center gap-3 rounded-[16px] p-3" style={row} data-testid={`${testId}-row`}>
              {i.tile}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2 mb-1.5">
                  <span className="text-[14.5px] font-extrabold min-w-0 truncate" style={{ color: 'var(--text-primary)' }}>{i.name ?? money(i.amount)}</span>
                  <span className="text-[12px] font-bold shrink-0" style={{ color: 'var(--text-primary)' }}>{i.name ? `${money(i.amount)} · ${i.bookings}` : `${i.bookings} ${i.bookings === 1 ? 'booking' : 'bookings'}`}</span>
                </div>
                <div className="h-[7px] rounded-full overflow-hidden" style={{ background: 'var(--bg-raised)' }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.max(2, (i.amount / max) * 100)}%`, background: MADE }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const LetterTile = ({ ch }: { ch: string }) => (
  <span aria-hidden className="inline-flex items-center justify-center shrink-0 text-white text-[15px] font-extrabold" style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(160deg,#4a535d,#2f363e)' }}>{ch}</span>
)
const methodLetter = (m: string) => (/card/i.test(m) ? '$' : /credit/i.test(m) ? 'C' : /venue|cash/i.test(m) ? 'V' : m.slice(0, 1).toUpperCase())
const initials = (n: string) => n.split(' ').filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase()

export default function FinancialReports({
  rows,
  creditTransactions,
  todayStr,
  venueSlug,
  runningCosts = null,
}: {
  rows: ReportRow[]
  creditTransactions: FinancialCreditTx[]
  // "Today" as the page already has it (matches the server's first render; see AdminDashboard).
  todayStr?: string
  venueSlug: string
  // Each club's running costs, for the breakeven line. Null before the 042 database change: the chart then looks as it always did.
  runningCosts?: Record<string, RunningCosts> | null
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
  const router = useRouter()
  // Costs saved from the small box on this page count straight away, before the page reloads its data.
  const [savedMonthly, setSavedMonthly] = useState<Record<string, number>>({})
  const baseCosts = runningCosts ? (runningCosts[venueSlug] ?? NO_COSTS) : null
  const costs = baseCosts ? (savedMonthly[venueSlug] !== undefined ? { monthly: savedMonthly[venueSlug], show: true } : baseCosts) : null
  const hasCosts = !!costs && costs.monthly > 0
  // The on/off switch is saved with the club (same setting as Club settings); until the page reloads, what was flipped here wins.
  const [flipped, setFlipped] = useState<Record<string, boolean>>({})
  const [flipping, setFlipping] = useState(false)
  const lineOn = hasCosts && (flipped[venueSlug] ?? costs!.show)
  const be = lineOn ? breakevenView(summary.byDay, costs!.monthly, today) : null
  const max = Math.max(1, ...summary.byDay.map(x => x.revenue), be?.daily ?? 0)
  const whole = (n: number) => money(n).replace(/\.00$/, '')
  const flipLine = async () => {
    const next = !lineOn
    setFlipped(f => ({ ...f, [venueSlug]: next })); setFlipping(true)
    try {
      const res = await fetch('/api/admin/running-costs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ venueSlug, show: next }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setFlipped(f => ({ ...f, [venueSlug]: !next })); toast.error(data.error ?? 'Could not save.') }
    } catch { setFlipped(f => ({ ...f, [venueSlug]: !next })); toast.error('Could not save. Check your connection and try again.') }
    setFlipping(false)
  }
  // The small "Running costs" box: opened from the line in the chart (or Edit in its key). Saving switches the line on.
  const [boxOpen, setBoxOpen] = useState(false)
  const [costText, setCostText] = useState('')
  const [savingCosts, setSavingCosts] = useState(false)
  const openBox = () => { setCostText(hasCosts ? String(costs!.monthly) : ''); setBoxOpen(true) }
  const typed = costText.trim() === '' ? NaN : Number(costText.replace(/[$, ]/g, ''))
  const typedOk = Number.isFinite(typed) && typed > 0 && typed <= 1_000_000
  const saveCosts = async () => {
    if (!typedOk) return
    const monthly = Math.round(typed * 100) / 100
    setSavingCosts(true)
    try {
      const res = await fetch('/api/admin/running-costs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ venueSlug, monthly, show: true }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) toast.error(data.error ?? 'Could not save.')
      else { setSavedMonthly(m => ({ ...m, [venueSlug]: monthly })); setFlipped(f => ({ ...f, [venueSlug]: true })); setBoxOpen(false); toast.success('Saved'); router.refresh() }
    } catch { toast.error('Could not save. Check your connection and try again.') }
    setSavingCosts(false)
  }
  const mid = summary.byDay[Math.floor(summary.byDay.length / 2)]
  const file = (what: string) => `padelmate-${what}-${clubName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${range.from}-to-${range.to}.csv`
  const [exporting, setExporting] = useState(false)
  const downloadExcel = async () => {
    setExporting(true)
    try {
      // loaded only when asked for, so the Reports tab stays light
      const { default: writeExcelFile } = await import('write-excel-file/browser')
      const bestDay = summary.byDay.reduce((m, x) => (x.revenue > m.revenue ? x : m), summary.byDay[0] ?? { date: '', revenue: 0, bookings: 0 })
      const midDay = summary.byDay[Math.floor(summary.byDay.length / 2)]
      const chart = await drawRevenueChart(summary.byDay, bestDay.date, { from: short(range.from), mid: midDay ? short(midDay.date) : '', to: short(range.to) }).catch(() => null)
      const sheets = buildWorkbook({ clubName, venueSlug, currency, range, prevRange, rows, summary, prev, preparedOn: today, chart })
      await writeExcelFile(sheets as any, { fontFamily: 'Calibri' } as any).toFile(file('report').replace(/\.csv$/, '.xlsx'))
    } finally { setExporting(false) }
  }
  const kpis = [
    { id: 'revenue', label: 'Revenue', value: money(summary.revenue), c: change(summary.revenue, prev.revenue), kind: 'money' as const, was: money(prev.revenue) },
    { id: 'bookings', label: 'Bookings', value: String(summary.bookings), c: change(summary.bookings, prev.bookings), kind: 'count' as const, was: String(prev.bookings) },
    { id: 'average', label: 'Average booking', value: money(summary.average), c: change(summary.average, prev.average), kind: 'money' as const, was: money(prev.average) },
    { id: 'cancelled', label: 'Cancelled (estimate)', value: money(summary.cancelled), c: change(summary.cancelled, prev.cancelled), kind: 'outflow' as const, was: money(prev.cancelled) },
  ]

  const phoneHide = 'hidden md:block'
  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:flex-wrap md:items-center justify-between gap-3">
        <div className="grid grid-cols-3 md:flex gap-1 rounded-[20px] md:rounded-full p-1 w-full md:w-auto" role="group" aria-label="Period" style={{ background: 'var(--bg-raised)' }}>
          {PERIOD_OPTIONS.map(p => (
            <button key={p.key} type="button" aria-pressed={key === p.key} data-on={key === p.key ? 'true' : undefined} data-testid={`report-period-${p.key}`} onClick={() => setKey(p.key)}
              className="wh-seg flex-1 md:flex-none px-4 py-2 rounded-full text-[13px] font-bold transition-all shrink-0 whitespace-nowrap"
              style={{ color: key === p.key ? undefined : 'var(--text-primary)', opacity: key === p.key ? 1 : 0.8 }}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col md:flex-row md:items-center gap-2 w-full md:w-auto">
          <button className="btn-main btn-main-lime md:!w-auto md:px-6 uppercase !text-[13px] tracking-wide" style={{ minHeight: 44 }} data-testid="report-xlsx" disabled={exporting} onClick={downloadExcel}>{exporting ? 'Preparing…' : 'Download Excel'}</button>
          <button className="hidden md:inline-flex items-center justify-center rounded-full px-5 text-[13px] font-extrabold uppercase tracking-wide" style={{ minHeight: 44, border: '1px solid var(--border-strong, var(--border))', color: 'var(--text-primary)' }} data-testid="report-print" onClick={() => window.print()}>Print or save as PDF</button>
          <button type="button" className="hidden md:inline text-xs font-bold px-1 disabled:opacity-40" data-testid="report-csv-bookings" disabled={summary.bookings === 0}
            style={{ color: 'var(--text-primary)', textDecoration: 'underline' }} title="A plain text file with no formatting, for accounting software"
            onClick={() => save(file('bookings'), detailedCsv(rows, range, { clubName, venueSlug, currency }))}>Plain CSV</button>
          <p className="md:hidden text-center text-[12px] font-semibold" style={{ color: 'var(--text-muted)' }}>PDF and CSV are on the PC</p>
        </div>
      </div>

      <p className="text-[12.5px] font-semibold flex flex-wrap gap-x-3" data-testid="report-range" style={{ color: 'var(--text-primary)' }}>
        <span>{clubName} · {long(range.from)} to {long(range.to)} · compared with {short(prevRange.from)} to {long(prevRange.to)}</span>
        {summary.bestWeekday && <span className="hidden md:inline" style={{ color: 'var(--text-muted)' }} data-testid="report-best-weekday">Strongest day: {summary.bestWeekday.name}</span>}
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((k, i) => (
          <div key={k.id} className={`rounded-[20px] p-5 ${i >= 2 ? phoneHide : ''}`} data-testid={`report-kpi-${k.id}`} style={tile}>
            <div className="text-[12.5px] font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{k.label}</div>
            <div className="text-[26px] md:text-[30px] font-extrabold leading-tight mb-2" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{k.value}</div>
            <Delta c={k.c} kind={k.kind} previousText={k.was} />
          </div>
        ))}
      </div>

      <div className="rounded-[20px] p-5" style={tile}>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mb-4">
          <Heading>Revenue by day</Heading>
          <div className="flex items-center gap-3 -mt-3">
            {summary.revenue > 0 && best.date && <MoneyBubble kind="gain" size={11.5} testId="report-best-day">Best day: {weekdayName(best.date).slice(0, 3)} {short(best.date)} · {whole(best.revenue)}</MoneyBubble>}
            {hasCosts && (
              <span className="hidden md:flex items-center gap-2">
                <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Line</span>
                <button type="button" role="switch" aria-checked={lineOn} aria-label="Breakeven line" disabled={flipping} onClick={() => void flipLine()}
                  className="shrink-0 relative rounded-full disabled:opacity-60" data-testid="report-breakeven-switch"
                  style={{ width: 46, height: 28, background: lineOn ? 'var(--today-block-bg)' : 'var(--bg-raised)', border: '1px solid var(--border)' }}>
                  <span aria-hidden className="absolute rounded-full" style={{ top: 3, left: lineOn ? 21 : 3, width: 20, height: 20, background: lineOn ? 'var(--today-block-fg)' : 'var(--text-subtle)', transition: 'left .15s' }} />
                </button>
              </span>
            )}
          </div>
        </div>
        {summary.revenue === 0 ? (
          <div className="text-sm text-center py-8" style={{ color: 'var(--text-primary)' }}>No revenue in this period yet.</div>
        ) : (
          <>
            <div className="relative flex items-end gap-[3px] md:gap-[5px] h-36 md:h-44" role="img" data-testid="report-chart" data-breakeven={be ? 'on' : 'off'}
              aria-label={`Revenue for each day from ${long(range.from)} to ${long(range.to)}. The best day was ${best.date ? `${weekdayName(best.date)} ${short(best.date)}` : 'none'} with ${money(best.revenue)}.${be ? ` The dashed line is breakeven, ${whole(be.daily)} a day: green days made money, grey days did not.` : ''}`}>
              {summary.byDay.map((x, i) => {
                const state = be?.marks[i]?.state
                return (
                  <div key={x.date} className="flex-1 rounded-t-[4px]" data-day={x.date} data-state={state ?? undefined}
                    title={`${weekdayName(x.date).slice(0, 3)} ${short(x.date)}: ${money(x.revenue)} · ${x.bookings} ${x.bookings === 1 ? 'booking' : 'bookings'}${state === 'today' ? ' (today, still going)' : ''}`}
                    style={{
                      height: `${x.revenue > 0 || state ? Math.max(3, (x.revenue / max) * 100) : 1}%`,
                      background: state ? (state === 'made' ? MADE : state === 'below' ? BELOW : GOING) : GOING,
                      opacity: state || x.revenue > 0 ? 1 : 0.35,
                    }} />
                )
              })}
              {be && <div aria-hidden data-testid="report-breakeven-line" className="absolute left-0 right-0 pointer-events-none" style={{ bottom: `${(be.daily / max) * 100}%`, borderTop: '2px dashed var(--text-primary)' }} />}
            </div>
            <div className="flex justify-between text-[11px] font-bold mt-2" style={{ color: 'var(--text-primary)' }}>
              <span>{short(range.from)}</span>{mid && summary.byDay.length > 6 && <span>{short(mid.date)}</span>}<span>{short(range.to)}</span>
            </div>
            {be && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] font-bold mt-3" data-testid="report-breakeven-legend" style={{ color: 'var(--text-primary)' }}>
                <span><i aria-hidden style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: MADE, marginRight: 6 }} />made money</span>
                <span><i aria-hidden style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: BELOW, marginRight: 6 }} />below costs</span>
                {be.todayInRange && <span><i aria-hidden style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: GOING, marginRight: 6 }} />today, still going</span>}
                <span><i aria-hidden style={{ display: 'inline-block', width: 18, borderTop: '2px dashed var(--text-primary)', verticalAlign: 'middle', marginRight: 6 }} />Breakeven: {whole(be.daily)} a day</span>
                <button type="button" className="underline" data-testid="report-costs-edit" onClick={openBox}>Edit</button>
              </div>
            )}
          </>
        )}
        {costs && !hasCosts && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-[16px] p-4 mt-4" style={row} data-testid="report-breakeven-prompt">
            <span className="flex items-center gap-3 flex-1 min-w-0"><i aria-hidden style={{ display: 'inline-block', width: 18, flex: 'none', borderTop: '2px dashed var(--text-primary)' }} />
            <span className="text-[13.5px] font-bold" style={{ color: 'var(--text-primary)' }}>Add your running costs to see which days made money</span></span>
            <button type="button" className="w-full sm:w-auto rounded-full px-4 py-2.5 text-[12px] font-extrabold uppercase tracking-wide" style={{ border: '1px solid var(--border-strong, var(--border))', color: 'var(--text-primary)' }} data-testid="report-breakeven-add" onClick={openBox}>Add running costs</button>
          </div>
        )}
        {boxOpen && (
          <div className="rounded-[20px] p-5 mt-4 max-w-md ml-auto" style={{ ...tile, background: 'var(--bg-surface)' }} data-testid="report-costs-box" role="dialog" aria-label="Running costs">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="text-[16px] font-extrabold" style={{ color: 'var(--text-primary)' }}>Running costs</div>
                <p className="text-[13px] mt-1" style={{ color: 'var(--text-primary)' }}>Rent, staff, power, balls: what it costs to open each month. Only owners see this.</p>
              </div>
              <button type="button" aria-label="Close" className="text-xl leading-none px-1" style={{ color: 'var(--text-primary)' }} onClick={() => setBoxOpen(false)}>×</button>
            </div>
            <label htmlFor="report-costs-input" className="block text-[12px] font-extrabold mt-4 mb-1.5" style={{ color: 'var(--text-primary)' }}>Each month</label>
            <div className="flex items-center rounded-[16px] px-4" style={{ minHeight: 52, background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
              <input id="report-costs-input" data-testid="report-costs-input" inputMode="decimal" autoFocus value={costText} placeholder="$7,000" disabled={savingCosts}
                onChange={e => setCostText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void saveCosts() }}
                className="flex-1 min-w-0 bg-transparent text-[20px] font-extrabold outline-none" style={{ color: 'var(--text-primary)' }} />
              {typedOk && <span className="text-[12.5px] font-bold shrink-0" style={{ color: 'var(--text-primary)' }} data-testid="report-costs-daily">= about {whole(Math.round(dailyBreakeven(typed)))} a day</span>}
            </div>
            <button type="button" className="btn-main btn-main-lime mt-4 uppercase !text-[13px] tracking-wide" data-testid="report-costs-save" disabled={!typedOk || savingCosts} onClick={() => void saveCosts()}>{savingCosts ? 'Saving…' : 'Save and show the line'}</button>
          </div>
        )}
      </div>

      {be && be.countedDays > 0 && (
        <div className="hidden md:grid grid-cols-3 gap-4" data-testid="report-breakeven-tiles">
          <div className="rounded-[20px] p-5" data-testid="report-be-taken" style={tile}>
            <div className="text-[12.5px] font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Taken</div>
            <div className="text-[26px] font-extrabold leading-tight" style={{ color: 'var(--text-primary)' }}>{whole(be.taken)}</div>
            <div className="mt-1 text-[12px] font-semibold" style={{ color: 'var(--text-muted)' }}>{be.countedDays} {be.countedDays === 1 ? 'day' : 'days'}{be.todayInRange ? ', not counting today' : ''}</div>
          </div>
          <div className="rounded-[20px] p-5" data-testid="report-be-costs" style={tile}>
            <div className="text-[12.5px] font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Running costs</div>
            <div className="text-[26px] font-extrabold leading-tight" style={{ color: 'var(--text-primary)' }}>{whole(be.costs)}</div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-semibold" style={{ color: 'var(--text-muted)' }}>{whole(be.daily)} a day <MoneyBubble kind="none" size={10}>set by you</MoneyBubble></div>
          </div>
          <div className="rounded-[20px] p-5" data-testid="report-be-left" data-sign={be.left > 0 ? 'profit' : be.left < 0 ? 'loss' : 'even'} style={tile}>
            <div className="text-[12.5px] font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Left over</div>
            <div className="text-[26px] font-extrabold leading-tight" style={{ color: 'var(--text-primary)' }}>{be.left < 0 ? '\u2212' : be.left > 0 ? '+' : ''}{whole(Math.abs(be.left))}</div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-semibold" style={{ color: 'var(--text-muted)' }}>
              {be.madeDays} of {be.countedDays} days made money
              <MoneyBubble kind={be.left > 0 ? 'gain' : be.left < 0 ? 'loss' : 'none'} size={10}>{be.left > 0 ? 'profit' : be.left < 0 ? 'loss' : 'even'}</MoneyBubble>
            </div>
          </div>
        </div>
      )}
      {be && be.countedDays === 0 && (
        <div className="rounded-[16px] px-4 py-3 text-sm font-semibold" data-testid="report-breakeven-wait" style={{ ...row, color: 'var(--text-primary)' }}>The breakeven numbers appear once a full day of this period has finished. Today is still going.</div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <Rows title="By court" testId="report-by-court" money={whole} items={summary.byCourt.map(c => ({ key: c.name, tile: <CourtBadge name={c.name} testId="report-court-tile" />, amount: c.revenue, bookings: c.bookings }))} />
        <Rows title="By payment method" testId="report-by-method" className={phoneHide} money={whole} items={summary.byMethod.map(m => ({ key: m.method, tile: <LetterTile ch={methodLetter(paymentLabel(m.method))} />, name: paymentLabel(m.method), amount: m.revenue, bookings: m.bookings }))} />
      </div>

      {summary.topMembers.length > 0 && (
        <div className="rounded-[20px] p-5" data-testid="report-top-members" style={tile}>
          <Heading>Top members by spend</Heading>
          <div className="space-y-2">
            {summary.topMembers.map((m, i) => (
              <div key={m.name + m.plan} className={`${i >= 3 ? 'hidden md:flex' : 'flex'} items-center gap-3 rounded-[16px] p-3`} style={row} data-testid="report-member">
                <span aria-hidden className="w-[38px] h-[38px] rounded-full inline-flex items-center justify-center text-[13px] font-extrabold text-white shrink-0" style={{ background: 'linear-gradient(160deg,#2c5fc4,#1d3f8d)' }}>{initials(m.name)}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[14.5px] font-extrabold truncate" style={{ color: 'var(--text-primary)' }}>{m.name}</span>
                  <span className="block text-[12px] font-bold" style={{ color: 'var(--text-primary)', opacity: 0.85 }}>{m.bookings} {m.bookings === 1 ? 'booking' : 'bookings'}</span>
                </span>
                {m.plan && <span className="hidden md:inline"><MoneyBubble kind="none" size={11}>{m.plan}</MoneyBubble></span>}
                <MoneyBubble kind="gain" size={12.5}>{whole(m.spent)}</MoneyBubble>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-[20px] p-4 items-center gap-3 flex-wrap hidden md:flex" data-testid="report-credits" style={tile}>
        <h3 className="text-[11.5px] font-extrabold uppercase mr-2" style={label}>Session credits</h3>
        <span className="sr-only">in this period:</span>
        <MoneyBubble kind="none" size={12}>{credits.issued} issued</MoneyBubble>
        <MoneyBubble kind="none" size={12}>{credits.used} used</MoneyBubble>
        <MoneyBubble kind="none" size={12}>{credits.refunded} refunded</MoneyBubble>
      </div>

      <div className="hidden md:block text-xs" style={{ color: 'var(--text-muted)' }}>
        &ldquo;Cancelled&rdquo; is an estimate: the price of bookings paid by card and later cancelled in this period, whether a full refund or a partial credit was actually given. Card refunds are made in Stripe and are not recorded here, so every export says the same.
      </div>

      {mounted && createPortal(
        <ReportSheet clubName={clubName} range={range} prevRange={prevRange} summary={summary} prev={prev} currency={currency} preparedOn={today} />,
        document.body,
      )}
    </div>
  )
}
