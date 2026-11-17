'use client'

import CardHeading from '@/components/ui/CardHeading'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import OfferSheet from '@/components/admin/OfferSheet'
import type { OfferRow } from '@/lib/offers'
import { formatDate } from '@/lib/utils'
import { currencyForVenueSlug, formatPrice } from '@/lib/currency'
import {
  computeEmptyCourtTime, splitOverdueShares, bestSlotsToFill,
  type BookingLite, type CourtLite, type UnpaidShareRow,
} from '@/lib/money-demand'
import { weekBounds, type WeekHours } from '@/lib/venue-hours'
import type { WaitDemand } from '@/lib/waitlist-rules'

const display = { fontFamily: 'var(--font-display), Manrope, sans-serif' } as const
const MAX_ROWS = 6

const card = { background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' } as const
const eyebrow = { letterSpacing: '0.14em', color: 'var(--text-subtle)' } as const

export default function MoneyDemand({ venueSlug, courts, bookings, unpaidShares, week, waitDemand = null, offers = null }: {
  venueSlug: string
  week?: WeekHours | null
  courts: CourtLite[]
  bookings: BookingLite[]
  unpaidShares: UnpaidShareRow[]
  waitDemand?: WaitDemand | null
  // null = offers aren't switched on yet (database change not run), so no Fill it buttons.
  offers?: OfferRow[] | null
}) {
  const router = useRouter()
  const [fill, setFill] = useState<{ date: string; from: string; to: string } | null>(null)
  // "Now" only exists in the browser: reading the clock while rendering on the
  // server would give a different answer from the client and trip hydration.
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [])

  const currency = currencyForVenueSlug(venueSlug)
  const wb = weekBounds(week)
  const bounds = { from: `${String(wb.firstHour).padStart(2, '0')}:00`, to: `${String(Math.min(wb.lastHour, 24)).padStart(2, '0')}:00` }

  return (
    <section className="mb-6">
      <CardHeading as="h2" size="section" className="mb-4" sub="Who still owes you, and the court time worth selling">Money &amp; demand</CardHeading>
      {now === null ? (
        <div className="rounded-2xl p-5 text-sm" style={{ ...card, color: 'var(--text-subtle)' }}>Loading…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
          <OverdueCard venueSlug={venueSlug} rows={unpaidShares} now={now} currency={currency} />
          <BestSlotsCard venueSlug={venueSlug} courts={courts} bookings={bookings} now={now} currency={currency} week={week} onFill={offers ? setFill : undefined} />
          {offers && offers.length > 0 && <OffersCard offers={offers} currency={currency} onChanged={() => router.refresh()} onFill={setFill} />}
          {waitDemand && <WaitlistCard demand={waitDemand} />}
        </div>
      )}
      {fill && (
        <OfferSheet venueSlug={venueSlug} date={fill.date} from={fill.from} to={fill.to} bounds={bounds} onClose={() => setFill(null)} onSent={() => { setFill(null); router.refresh() }} />
      )}
    </section>
  )
}

function OverdueCard({ venueSlug, rows, now, currency }: { venueSlug: string; rows: UnpaidShareRow[]; now: number; currency: ReturnType<typeof currencyForVenueSlug> }) {
  const s = splitOverdueShares(rows, venueSlug, now)
  const shown = s.overdue.slice(0, MAX_ROWS)
  const [sent, setSent] = useState<Record<string, 'busy' | 'sent' | 'error'>>({})
  async function remind(id: string) {
    setSent(p => ({ ...p, [id]: 'busy' }))
    try {
      const res = await fetch('/api/admin/remind-shares', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
      setSent(p => ({ ...p, [id]: res.ok ? 'sent' : 'error' }))
    } catch { setSent(p => ({ ...p, [id]: 'error' })) }
  }
  return (
    <div className="rounded-2xl p-5" style={card} data-testid="overdue-card">
      <CardHeading className="">Overdue shares</CardHeading>
      {s.overdue.length === 0 ? (
        <div className="py-6">
          <div className="text-2xl font-extrabold" style={{ ...display, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Nothing overdue</div>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Every friend is either paid up or still inside their time to pay.</p>
        </div>
      ) : (
        <>
          <div className="mt-2.5 flex items-baseline gap-2 flex-wrap">
            <span className="text-[38px] leading-none font-extrabold" style={{ ...display, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>{formatPrice(s.overdueTotal, currency)}</span>
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>across {s.overdue.length} {s.overdue.length === 1 ? 'share' : 'shares'}</span>
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Friends who joined a game and are past the time they had to pay their part.</p>
          <div className="mt-4" style={{ borderTop: '1px solid var(--border)' }}>
            {shown.map(r => (
              <div key={r.id} className="flex items-center justify-between gap-3 py-2.5" style={{ borderBottom: '1px solid var(--border)' }} data-testid="overdue-row">
                <div className="min-w-0">
                  <div className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>{r.playerName} <span className="font-extrabold" style={{ color: 'var(--text-muted)' }}>· {formatPrice(r.amount, currency)}</span></div>
                  <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {r.courtName} · {formatDate(r.date)} {r.startTime.slice(0, 5)}{r.organiserName ? ` · organised by ${r.organiserName}` : ''}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <button type="button" disabled={sent[r.id] === 'busy' || sent[r.id] === 'sent'} onClick={() => remind(r.id)}
                    className="text-xs font-extrabold px-3 py-1.5 rounded-full disabled:opacity-60" style={{ background: 'var(--brand-primary)', color: '#fff' }} data-testid="remind-both">
                    {sent[r.id] === 'sent' ? 'Reminded' : sent[r.id] === 'busy' ? 'Sending…' : 'Remind both'}
                  </button>
                  {sent[r.id] === 'error' && <div className="text-[10.5px] mt-1" style={{ color: 'var(--brand-crimson)' }}>Could not send. Try again.</div>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {s.notDueCount > 0 && (
        <p className="text-[11.5px] mt-3" data-testid="not-due-note" style={{ color: 'var(--text-subtle)' }}>
          {s.notDueCount} more {s.notDueCount === 1 ? 'share' : 'shares'} ({formatPrice(s.notDueTotal, currency)}) {s.notDueCount === 1 ? 'is' : 'are'} not due yet. Reminders for those go out automatically.
          {s.overdue.length > shown.length ? ` Showing the ${shown.length} oldest overdue.` : ''}
        </p>
      )}
    </div>
  )
}

const WEEKDAY_NAMES = ['Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Sundays']

// People who asked to be told when a full time opened: the clearest sign a club
// could sell more of that time.
function WaitlistCard({ demand }: { demand: WaitDemand }) {
  const max = Math.max(1, ...demand.slots.map(s => s.waits))
  return (
    <div className="rounded-2xl p-5 lg:col-span-2" style={card} data-testid="waitlist-demand">
      <CardHeading className="">Waitlist demand · last 14 days</CardHeading>
      {demand.total === 0 ? (
        <p className="text-sm py-6" style={{ color: 'var(--text-muted)' }}>Nobody has waited for a full time yet. When your busy times fill up, the times people can&apos;t get will show here.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-x-8 gap-y-2 mt-2">
            <div>
              <div className="text-3xl font-bold" style={{ ...display, color: 'var(--text-primary)' }}>{demand.total}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{demand.total === 1 ? 'wait joined' : 'waits joined'}</div>
            </div>
            <div>
              <div className="text-3xl font-bold" style={{ ...display, color: 'var(--brand-primary-text)' }}>{demand.bookedAfter}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>booked after being told</div>
            </div>
          </div>
          <div className="text-[11px] font-bold uppercase tracking-wide mt-5 mb-2" style={{ color: 'var(--text-subtle)' }}>Times people can&apos;t get</div>
          <ul className="space-y-2">
            {demand.slots.map(s => (
              <li key={`${s.weekday}-${s.time}`} className="flex items-center gap-3 text-sm">
                <span className="w-32 shrink-0" style={{ color: 'var(--text-primary)' }}>{WEEKDAY_NAMES[s.weekday]} {s.time}</span>
                <span className="h-2 rounded-full flex-1" style={{ background: 'var(--bg-raised)' }}>
                  <span className="block h-2 rounded-full" style={{ width: `${Math.round((s.waits / max) * 100)}%`, background: 'var(--brand-primary)' }} />
                </span>
                <span className="w-16 text-right tabular-nums" style={{ color: 'var(--text-muted)' }}>{s.waits} {s.waits === 1 ? 'person' : 'people'}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

// The slots in the next 7 days most worth selling, ranked by what their empty courts
// could earn, each with a Fill it button that opens the offer sheet.
function BestSlotsCard({ venueSlug, courts, bookings, now, currency, week, onFill }: { onFill?: (g: { date: string; from: string; to: string }) => void; venueSlug: string; courts: CourtLite[]; bookings: BookingLite[]; now: number; currency: ReturnType<typeof currencyForVenueSlug>; week?: WeekHours | null }) {
  const e = computeEmptyCourtTime(courts, bookings, venueSlug, now, 7, week)
  if (e.courtCount === 0) {
    return (
      <div className="rounded-2xl p-5" style={card}>
        <CardHeading className="">Best slots to fill</CardHeading>
        <p className="text-sm py-6" style={{ color: 'var(--text-muted)' }}>This club has no courts set up yet. Add them in the Courts tab and the slots worth filling will show here.</p>
      </div>
    )
  }
  const best = bestSlotsToFill(e.slots, 5)
  return (
    <div className="rounded-2xl p-5" style={card} data-testid="best-slots">
      <CardHeading className="">Best slots to fill · next 7 days</CardHeading>
      {best.length === 0 ? (
        <p className="text-sm py-6" style={{ color: 'var(--text-muted)' }}>Nothing left to sell in the next 7 days. Every open hour is booked or blocked.</p>
      ) : (
        <>
          <div className="mt-2.5 flex items-baseline gap-2 flex-wrap">
            <span className="text-[38px] leading-none font-extrabold" style={{ ...display, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>{formatPrice(e.potential, currency)}</span>
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>if they all filled</span>
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            {e.emptyHours} {e.emptyHours === 1 ? 'court hour' : 'court hours'} unsold in the next 7 days. These are the five worth the most.
          </p>
          <div className="mt-4" style={{ borderTop: '1px solid var(--border)' }}>
            {best.map(g => (
              <div key={`${g.date}-${g.from}`} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-2.5" style={{ borderBottom: '1px solid var(--border)' }} data-testid="best-slot-row">
                <div className="min-w-0">
                  <div className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>{formatDate(g.date)} · <span className="whitespace-nowrap">{g.from}–{g.to}</span></div>
                  <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{g.fillPct}% full · {g.empty} of {g.courts} {g.courts === 1 ? 'court' : 'courts'} free · {g.kind === 'peak' ? 'peak' : 'quiet'}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-xs font-extrabold whitespace-nowrap" style={{ color: 'var(--brand-primary-text)' }}>up to {formatPrice(g.potential, currency)}</div>
                  {onFill && (
                    <button type="button" onClick={() => onFill({ date: g.date, from: g.from, to: g.to })}
                      className="text-xs font-extrabold px-3 py-1.5 rounded-full" style={{ background: 'var(--brand-primary)', color: '#fff' }}>Fill it</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      <p className="text-[11.5px] mt-3" style={{ color: 'var(--text-subtle)' }}>
        Ranked by what a full slot could earn. Counted within your opening hours{week ? '' : ' (07:00 to 22:00 until you set them)'}. Hours already started and blocked courts are not counted.
      </p>
    </div>
  )
}

// Offers the owner has sent, with what each one achieved.
function OffersCard({ offers, currency, onChanged, onFill }: { offers: OfferRow[]; currency: ReturnType<typeof currencyForVenueSlug>; onChanged: () => void; onFill: (g: { date: string; from: string; to: string }) => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  async function end(id: string) {
    setBusy(id)
    try { await fetch('/api/admin/offers/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }) } finally { setBusy(null); onChanged() }
  }
  return (
    <div className="rounded-2xl p-5 lg:col-span-2" style={card} data-testid="offers-card">
      <CardHeading className="">Offers you&apos;ve sent</CardHeading>
      <div className="mt-2">
        {offers.map(o => (
          <div key={o.id} className="py-3" style={{ borderBottom: '1px solid var(--border)' }} data-testid="offer-row">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>{o.discount_percent}% off · {formatDate(o.date)} · {o.start_time.slice(0, 5)}–{o.end_time.slice(0, 5)}</div>
                <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Told {o.told_count} {o.told_count === 1 ? 'player' : 'players'} · {o.status === 'cancelled' ? 'Ended early' : o.ended ? 'Closed' : 'Open now'}
                </div>
              </div>
              <div className="flex gap-2">
                {!o.ended && (
                  <button type="button" disabled={busy === o.id} onClick={() => end(o.id)} className="text-xs font-bold px-3 py-1.5 rounded-full disabled:opacity-50" style={{ background: 'var(--bg-raised)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>End offer</button>
                )}
                {o.ended && o.date >= new Date().toISOString().slice(0, 10) && (
                  <button type="button" onClick={() => onFill({ date: o.date, from: o.start_time.slice(0, 5), to: o.end_time.slice(0, 5) })} className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: 'var(--bg-raised)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>Run it again</button>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-[12px]" style={{ color: 'var(--text-muted)' }}>
              <span><b style={{ color: 'var(--text-primary)' }}>{o.results.courtsBooked}</b> {o.results.courtsBooked === 1 ? 'court' : 'courts'} booked</span>
              <span>Earned <b style={{ color: 'var(--text-primary)' }}>{formatPrice(o.results.earned, currency)}</b></span>
              <span>Given away <b style={{ color: 'var(--text-primary)' }}>{formatPrice(o.results.givenAway, currency)}</b></span>
              <span><b style={{ color: 'var(--text-primary)' }}>{o.results.newPlayers}</b> new · <b style={{ color: 'var(--text-primary)' }}>{o.results.returning}</b> returning</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
