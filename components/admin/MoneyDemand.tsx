'use client'

import { useEffect, useState } from 'react'
import { formatDate } from '@/lib/utils'
import { currencyForVenueSlug, formatPrice } from '@/lib/currency'
import {
  computeEmptyCourtTime, summariseUnpaidShares,
  type BookingLite, type CourtLite, type UnpaidShareRow,
} from '@/lib/money-demand'

const display = { fontFamily: 'var(--font-display), Manrope, sans-serif' } as const
const MAX_ROWS = 6

const card = { background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' } as const
const eyebrow = { letterSpacing: '0.14em', color: 'var(--text-subtle)' } as const

const BAND_STYLE = {
  fresh: { background: 'var(--bg-raised)', color: 'var(--text-muted)' },
  mid: { background: 'var(--brand-primary-muted)', color: 'var(--brand-primary-text)' },
  old: { background: 'var(--brand-crimson-muted)', color: 'var(--brand-crimson)' },
} as const

const BAND_FILL = { fresh: 'var(--text-subtle)', mid: 'var(--brand-primary)', old: 'var(--brand-crimson)' } as const
const KIND_LABEL = { peak: 'Peak hours', quiet: 'Quiet hours', mixed: 'Peak and quiet hours' } as const

const ageLabel = (d: number) => (d === 0 ? 'Today' : d === 1 ? '1 day' : `${d} days`)

export default function MoneyDemand({ venueSlug, courts, bookings, unpaidShares }: {
  venueSlug: string
  courts: CourtLite[]
  bookings: BookingLite[]
  unpaidShares: UnpaidShareRow[]
}) {
  // "Now" only exists in the browser: reading the clock while rendering on the
  // server would give a different answer from the client and trip hydration.
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [])

  const currency = currencyForVenueSlug(venueSlug)

  return (
    <section className="mb-6">
      <div className="mb-3">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)', ...display }}>Money &amp; demand</h2>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>What you&apos;re still owed, and the court time still to sell</p>
      </div>
      {now === null ? (
        <div className="rounded-2xl p-5 text-sm" style={{ ...card, color: 'var(--text-subtle)' }}>Loading…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <UnpaidCard venueSlug={venueSlug} rows={unpaidShares} now={now} currency={currency} />
          <EmptyTimeCard venueSlug={venueSlug} courts={courts} bookings={bookings} now={now} currency={currency} />
        </div>
      )}
    </section>
  )
}

function UnpaidCard({ venueSlug, rows, now, currency }: { venueSlug: string; rows: UnpaidShareRow[]; now: number; currency: ReturnType<typeof currencyForVenueSlug> }) {
  const s = summariseUnpaidShares(rows, venueSlug, now)
  const shown = s.rows.slice(0, MAX_ROWS)
  return (
    <div className="rounded-2xl p-5" style={card}>
      <div className="text-[11px] font-extrabold uppercase" style={eyebrow}>Unpaid shares</div>
      {s.count === 0 ? (
        <div className="py-6">
          <div className="text-2xl font-extrabold" style={{ ...display, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Nothing outstanding</div>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Every friend who joined a game has paid their part of the court.</p>
        </div>
      ) : (
        <>
          <div className="mt-2.5 flex items-baseline gap-2 flex-wrap">
            <span className="text-[38px] leading-none font-extrabold" style={{ ...display, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>{formatPrice(s.total, currency)}</span>
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>across {s.count} {s.count === 1 ? 'share' : 'shares'}</span>
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Friends who joined a game but haven&apos;t paid their part of the court.</p>

          <div className="flex h-3 rounded-full overflow-hidden mt-4" style={{ gap: 2 }} aria-hidden>
            {(['fresh', 'mid', 'old'] as const).map(b => s.bands[b].count > 0 && (
              <div key={b} style={{ width: `${(s.bands[b].amount / s.total) * 100}%`, background: BAND_FILL[b] }} />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5 text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
            {([['fresh', 'Under 2 days'], ['mid', '2–7 days'], ['old', 'Over 7 days']] as const).map(([b, label]) => (
              <span key={b} className="inline-flex items-center gap-1.5">
                <span style={{ width: 8, height: 8, borderRadius: 999, background: BAND_FILL[b], display: 'inline-block' }} />
                {label} <b style={{ color: 'var(--text-primary)' }}>{formatPrice(s.bands[b].amount, currency)}</b>
              </span>
            ))}
          </div>

          <div className="mt-4" style={{ borderTop: '1px solid var(--border)' }}>
            {shown.map(r => (
              <div key={r.id} className="flex items-center justify-between gap-3 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>{r.playerName}</div>
                  <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {r.courtName} · {formatDate(r.date)} {r.startTime.slice(0, 5)}{r.organiserName ? ` · organised by ${r.organiserName}` : ''}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[13px] font-extrabold" style={{ color: 'var(--text-primary)' }}>{formatPrice(r.amount, currency)}</div>
                  <span className="inline-block text-[10.5px] font-extrabold px-2 py-0.5 rounded-full mt-0.5" style={BAND_STYLE[r.band]}>{ageLabel(r.ageDays)}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11.5px] mt-3" style={{ color: 'var(--text-subtle)' }}>
            {s.count > shown.length ? `Showing the ${shown.length} oldest of ${s.count}. ` : 'Oldest first. '}
            Reminders already go out automatically; this shows what is still outstanding.
          </p>
        </>
      )}
    </div>
  )
}

function EmptyTimeCard({ venueSlug, courts, bookings, now, currency }: { venueSlug: string; courts: CourtLite[]; bookings: BookingLite[]; now: number; currency: ReturnType<typeof currencyForVenueSlug> }) {
  const e = computeEmptyCourtTime(courts, bookings, venueSlug, now)
  if (e.courtCount === 0) {
    return (
      <div className="rounded-2xl p-5" style={card}>
        <div className="text-[11px] font-extrabold uppercase" style={eyebrow}>Empty court time · next 7 days</div>
        <p className="text-sm py-6" style={{ color: 'var(--text-muted)' }}>This club has no courts set up yet. Add them in the Courts tab and the empty hours will show here.</p>
      </div>
    )
  }
  // The two emptiest days stand out so the quiet spots are obvious at a glance.
  const withFill = e.days.filter(d => d.fillPct !== null)
  const lowest = new Set(withFill.length >= 3 ? [...withFill].sort((a, b) => a.fillPct! - b.fillPct!).slice(0, 2).map(d => d.date) : [])
  return (
    <div className="rounded-2xl p-5" style={card}>
      <div className="text-[11px] font-extrabold uppercase" style={eyebrow}>Empty court time · next 7 days</div>
      <div className="mt-2.5 flex items-baseline gap-2 flex-wrap">
        <span className="text-[38px] leading-none font-extrabold" style={{ ...display, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>{e.emptyHours} {e.emptyHours === 1 ? 'hour' : 'hours'}</span>
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>still unsold</span>
      </div>
      <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
        About <b style={{ color: 'var(--text-primary)' }}>{formatPrice(e.potential, currency)}</b> in court fees if they all filled, at your listed prices.
      </p>

      <div className="grid gap-2 mt-5 items-end" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', height: 118 }}>
        {e.days.map(d => (
          <div key={d.date} className="flex flex-col items-center justify-end h-full gap-1" title={d.fillPct === null ? `${d.label}: nothing left to sell` : `${d.label}: ${d.fillPct}% full`}>
            <div className="text-[10.5px] font-extrabold" style={{ color: 'var(--text-primary)' }}>{d.fillPct === null ? '—' : `${d.fillPct}%`}</div>
            <div className="w-full flex-1 flex items-end overflow-hidden" style={{ background: 'var(--bg-raised)', borderRadius: '8px 8px 4px 4px' }}>
              <div className="w-full" style={{ height: `${d.fillPct ?? 0}%`, background: lowest.has(d.date) ? 'var(--brand-yellow)' : 'var(--brand-primary)' }} />
            </div>
            <div className="text-[10.5px] font-bold" style={{ color: 'var(--text-muted)' }}>{d.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2.5 mt-4">
        {[
          { n: e.peak.empty, t: 'peak (5–9pm and weekends)', fill: e.peak.fillPct },
          { n: e.quiet.empty, t: 'quiet hours', fill: e.quiet.fillPct },
        ].map(b => (
          <div key={b.t} className="rounded-xl px-3 py-2.5" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
            <div className="text-lg font-extrabold" style={{ ...display, color: 'var(--text-primary)' }}>{b.n} {b.n === 1 ? 'hr' : 'hrs'}</div>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>empty at {b.t}{b.fill === null ? '' : ` · ${b.fill}% full`}</div>
          </div>
        ))}
      </div>

      <div className="mt-4" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="text-[11px] font-extrabold uppercase mt-3 mb-1" style={eyebrow}>Biggest gaps</div>
        {e.gaps.length === 0 ? (
          <p className="text-xs py-3" style={{ color: 'var(--text-muted)' }}>No long gaps. Courts are filling evenly across the week.</p>
        ) : e.gaps.map(g => (
          <div key={`${g.date}-${g.from}`} className="flex items-center justify-between gap-3 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="min-w-0">
              <div className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>{formatDate(g.date)} · {g.from}–{g.to}</div>
              <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{KIND_LABEL[g.kind]}</div>
            </div>
            <div className="text-xs font-extrabold whitespace-nowrap" style={{ color: 'var(--brand-primary-text)' }}>{g.courts} {g.courts === 1 ? 'court' : 'courts'} free</div>
          </div>
        ))}
      </div>
      <p className="text-[11.5px] mt-3" style={{ color: 'var(--text-subtle)' }}>
        Counted between 07:00 and 22:00. Hours already started and courts you&apos;ve blocked aren&apos;t counted. The emptiest days are highlighted.
      </p>
    </div>
  )
}
