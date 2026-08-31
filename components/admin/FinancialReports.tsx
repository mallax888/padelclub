'use client'

import { useState } from 'react'
import { localDateStr } from '@/lib/utils'
import { currencyForRegion, formatPrice, formatMultiCurrency } from '@/lib/currency'
import { getVenue } from '@/lib/venues'
import { computeFinancialSummary, type FinancialBooking, type FinancialCreditTx } from '@/lib/analytics'

const PERIODS = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
] as const

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  card: 'Card',
  credits: 'Session credits',
  membership_allowance: 'Membership allowance',
  staff_block: 'Staff block',
}

type ReportBooking = FinancialBooking & { court_name: string; member_name: string; start_time: string }

function toCsv(bookings: ReportBooking[]): string {
  const header = ['Date', 'Time', 'Court', 'Member', 'Amount', 'Currency', 'Payment method', 'Status']
  const rows = bookings.map(b => {
    const currency = currencyForRegion(b.venue_slug ? getVenue(b.venue_slug).region : undefined)
    return [
      b.date,
      b.start_time?.slice(0, 5) ?? '',
      b.court_name,
      b.member_name,
      b.price_nzd.toFixed(2),
      currency.toUpperCase(),
      PAYMENT_METHOD_LABELS[b.payment_method] ?? b.payment_method,
      b.status,
    ]
  })
  return [header, ...rows].map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
}

export default function FinancialReports({
  bookings,
  creditTransactions,
}: {
  bookings: ReportBooking[]
  creditTransactions: FinancialCreditTx[]
}) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['days']>(30)
  const today = localDateStr()
  const summary = computeFinancialSummary(bookings, creditTransactions, today, period)

  const since = new Date(today + 'T00:00:00')
  since.setDate(since.getDate() - (period - 1))
  const sinceStr = localDateStr(since)
  const inPeriod = bookings.filter(b => b.date >= sinceStr && b.date <= today && (b.status === 'confirmed' || b.status === 'completed'))

  const downloadCsv = () => {
    const csv = toCsv(inPeriod)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `padelclub-revenue-${sinceStr}-to-${today}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg p-1" style={{ background: 'var(--bg-raised)' }}>
          {PERIODS.map(p => (
            <button key={p.days} onClick={() => setPeriod(p.days)}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{ background: period === p.days ? 'var(--brand-primary)' : 'transparent', color: period === p.days ? 'var(--brand-primary-on)' : 'var(--text-muted)' }}>
              {p.label}
            </button>
          ))}
        </div>
        <button className="btn btn-sm" onClick={downloadCsv} disabled={inPeriod.length === 0}>
          ⬇ Export CSV ({inPeriod.length} bookings)
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Gross revenue', value: formatMultiCurrency(summary.grossByCurrency), color: 'var(--brand-primary-text)' },
          { label: 'Cancelled & refunded', value: formatMultiCurrency(summary.cancelledRevenueByCurrency), color: 'var(--brand-crimson)' },
          { label: 'Session credits issued', value: summary.creditsIssued, color: 'var(--text-primary)' },
          { label: 'Session credits refunded', value: summary.creditsRefunded, color: 'var(--brand-accent)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-2xl p-4"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
            <div className="text-xs mb-1" style={{ color: 'var(--text-subtle)' }}>{label}</div>
            <div className="text-xl font-semibold" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl p-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
        <div className="text-sm font-medium mb-4" style={{ color: 'var(--text-primary)' }}>Revenue by payment method</div>
        {summary.byPaymentMethod.length === 0 ? (
          <div className="text-sm text-center py-6" style={{ color: 'var(--text-subtle)' }}>No revenue in this period yet.</div>
        ) : (
          <div className="space-y-3">
            {(() => {
              const max = Math.max(1, ...summary.byPaymentMethod.map(m => m.amount))
              return summary.byPaymentMethod.map(m => (
                <div key={m.method + m.currency}>
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{PAYMENT_METHOD_LABELS[m.method] ?? m.method}</div>
                    <div className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
                      {formatPrice(m.amount, m.currency)} · {m.bookings} {m.bookings === 1 ? 'booking' : 'bookings'}
                    </div>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-raised)' }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.max(2, (m.amount / max) * 100)}%`, background: 'var(--brand-primary)' }} />
                  </div>
                </div>
              ))
            })()}
          </div>
        )}
      </div>

      <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>
        "Cancelled & refunded" is an estimate — the total price of bookings that were paid via card and later cancelled in this period, whether a full refund or partial credit was actually issued. Card refunds themselves aren't recorded in a local ledger, only sent to Stripe directly.
      </div>
    </div>
  )
}
