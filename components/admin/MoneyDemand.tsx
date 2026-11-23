'use client'

import { fmtClock, fmtClockRange } from '@/lib/clock'
import { GO } from '@/lib/accent'
import CardHeading from '@/components/ui/CardHeading'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import OfferSheet from '@/components/admin/OfferSheet'
import type { OfferRow } from '@/lib/offers'
import { closedOfferLine, splitOffers } from '@/lib/offers-view'
import { timezoneForVenueSlug } from '@/lib/timezone'
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

const LIME = GO
const cardEyebrow = { fontSize: 11, letterSpacing: '0.14em', fontWeight: 800, color: 'var(--text-subtle)' } as const
const bigTotal = { fontFamily: 'var(--font-display), Manrope, sans-serif', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-primary)' } as const
const WK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

// A small blue tile for a date, like the court tile on a booking: SAT / 24 / OCT.
function DateTile({ date, month = false }: { date: string; month?: boolean }) {
  const d = new Date(`${date}T12:00:00Z`)
  return (
    <span aria-hidden className="shrink-0 inline-flex flex-col items-center justify-center text-white text-center" style={{ width: 52, height: 52, borderRadius: 15, background: 'linear-gradient(160deg,#2c5fc4,#1d3f8d)' }}>
      <span style={{ fontSize: 9, letterSpacing: '0.1em', fontWeight: 700, lineHeight: 1.1 }}>{WK[d.getUTCDay()]}</span>
      <span style={{ fontSize: 20, fontWeight: 800, lineHeight: 1 }}>{d.getUTCDate()}</span>
      {month && <span style={{ fontSize: 9, letterSpacing: '0.1em', fontWeight: 700, lineHeight: 1.1 }}>{MON[d.getUTCMonth()]}</span>}
    </span>
  )
}

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
          {offers && offers.length > 0 && <OffersCard offers={offers} currency={currency} today={new Intl.DateTimeFormat('en-CA', { timeZone: timezoneForVenueSlug(venueSlug) }).format(now)} onChanged={() => router.refresh()} onFill={setFill} />}
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
  const none = s.overdue.length === 0
  return (
    <div className="rounded-[20px] p-5" style={card} data-testid="overdue-card">
      <div style={cardEyebrow}>OVERDUE SHARES</div>
      {none ? (
        <div className="py-3">
          <div className="text-2xl font-extrabold" style={{ ...bigTotal }}>Nothing overdue</div>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Every friend is either paid up or still inside their time to pay.</p>
        </div>
      ) : (
        <>
          <div className="mt-2 flex items-baseline gap-2 flex-wrap">
            <span className="text-[40px] leading-none" style={bigTotal}>{formatPrice(s.overdueTotal, currency)}</span>
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>across {s.overdue.length} {s.overdue.length === 1 ? 'share' : 'shares'}</span>
          </div>
          <p className="text-xs mt-2 mb-1" style={{ color: 'var(--text-muted)' }}>Friends who joined a game and are past the time they had to pay their part.</p>
        </>
      )}
      <div>
        {!none && shown.map((r, i) => (
          <div key={r.id} className="flex items-center gap-3.5 py-3" style={{ borderTop: '1px solid var(--border)' }} data-testid="overdue-row">
            <DateTile date={r.date} month />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>{r.playerName}</div>
              <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {r.courtName} · {formatDate(r.date)} {fmtClock(r.startTime)}{r.organiserName ? ` · organised by ${r.organiserName}` : ''}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0" style={{ width: ACTION_W }}>
              <div className="text-right leading-tight"><div className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>owes</div><div className="text-[17px] font-extrabold whitespace-nowrap" style={{ color: 'var(--text-primary)' }} data-testid="overdue-amount">{formatPrice(r.amount, currency)}</div></div>
              <button type="button" disabled={sent[r.id] === 'busy' || sent[r.id] === 'sent'} onClick={() => remind(r.id)}
                className="w-full text-center text-xs font-extrabold px-2 py-2 rounded-full disabled:opacity-60" style={LIME} data-testid="remind-both">
                {sent[r.id] === 'sent' ? 'Reminded' : sent[r.id] === 'busy' ? 'Sending…' : 'Remind both'}
              </button>
              {sent[r.id] === 'error' && <div className="text-[10.5px] mt-1" style={{ color: 'var(--brand-crimson)' }}>Could not send. Try again.</div>}
            </div>
          </div>
        ))}
        {s.notDueCount > 0 && (
          <p className="text-[11.5px] mt-3" data-testid="not-due-note" style={{ color: 'var(--text-subtle)' }}>
            {s.notDueCount} more {s.notDueCount === 1 ? 'share' : 'shares'} ({formatPrice(s.notDueTotal, currency)}) {s.notDueCount === 1 ? 'is' : 'are'} not due yet. Reminders for those go out automatically.
            {s.overdue.length > shown.length ? ` Showing the ${shown.length} oldest overdue.` : ''}
          </p>
        )}
      </div>
    </div>
  )
}

// The right-hand column of both lists: the price, then one button, the same width in each card.
const ACTION_W = 118

const WEEKDAY_NAMES = ['Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Sundays']

// People who asked to be told when a full time opened: the clearest sign a club
// could sell more of that time.
function WaitlistCard({ demand }: { demand: WaitDemand }) {
  const max = Math.max(1, ...demand.slots.map(s => s.waits))
  return (
    <div className="rounded-[20px] p-5 lg:col-span-2" style={card} data-testid="waitlist-demand">
      <CardHeading className="">Waitlist demand · last 14 days</CardHeading>
      {demand.total === 0 ? (
        <div className="flex items-center gap-4 mt-3">
          <span aria-hidden className="shrink-0 inline-flex items-end gap-1.5" style={{ height: 44 }}>
            {[14, 24, 34, 20].map((h, i) => <i key={i} style={{ width: 12, height: h, borderRadius: 4, background: 'var(--bg-raised)', display: 'block' }} />)}
          </span>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nobody has waited for a full time yet. When your busy times fill up, the times people can&apos;t get will show here.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-x-8 gap-y-2 mt-2">
            <div>
              <div className="text-3xl font-bold" style={{ ...display, color: 'var(--text-primary)' }}>{demand.total}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{demand.total === 1 ? 'wait joined' : 'waits joined'}</div>
            </div>
            <div>
              <div className="text-3xl font-bold" style={{ ...display, color: 'var(--go-text)' }}>{demand.bookedAfter}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>booked after being told</div>
            </div>
          </div>
          <div className="text-[11px] font-bold uppercase tracking-wide mt-5 mb-2" style={{ color: 'var(--text-subtle)' }}>Times people can&apos;t get</div>
          <ul className="space-y-2">
            {demand.slots.map(s => (
              <li key={`${s.weekday}-${s.time}`} className="flex items-center gap-3 text-sm">
                <span className="w-32 shrink-0" style={{ color: 'var(--text-primary)' }}>{WEEKDAY_NAMES[s.weekday]} {fmtClock(s.time)}</span>
                <span className="h-2 rounded-full flex-1" style={{ background: 'var(--bg-raised)' }}>
                  <span className="block h-2 rounded-full" style={{ width: `${Math.round((s.waits / max) * 100)}%`, background: '#1f9a5f' }} />
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
      <div className="rounded-[20px] p-5" style={card}>
        <CardHeading className="">Best slots to fill</CardHeading>
        <p className="text-sm py-6" style={{ color: 'var(--text-muted)' }}>This club has no courts set up yet. Add them in the Courts tab and the slots worth filling will show here.</p>
      </div>
    )
  }
  const best = bestSlotsToFill(e.slots, 5)
  return (
    <div className="rounded-[20px] p-5" style={card} data-testid="best-slots">
      <div style={cardEyebrow}>BEST SLOTS TO FILL · NEXT 7 DAYS</div>
      {best.length === 0 ? (
        <p className="text-sm py-6" style={{ color: 'var(--text-muted)' }}>Nothing left to sell in the next 7 days. Every open hour is booked or blocked.</p>
      ) : (
        <>
          <div className="mt-2 flex items-baseline gap-2 flex-wrap">
            <span className="text-[40px] leading-none" style={bigTotal}>{formatPrice(e.potential, currency)}</span>
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>if they all filled</span>
          </div>
          <p className="text-xs mt-2 mb-1" style={{ color: 'var(--text-muted)' }}>
            {e.emptyHours} {e.emptyHours === 1 ? 'court hour' : 'court hours'} unsold in the next 7 days. These are the five worth the most.
          </p>
        </>
      )}
      <div>
        {best.map((g, i) => (
          <div key={`${g.date}-${g.from}`} className="flex items-center gap-3.5 py-3" style={{ borderTop: '1px solid var(--border)' }} data-testid="best-slot-row">
            <DateTile date={g.date} />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-bold whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{fmtClockRange(g.from, g.to)}</div>
              <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{formatDate(g.date)} · {g.fillPct}% full · {g.empty} of {g.courts} {g.courts === 1 ? 'court' : 'courts'} free · {g.kind === 'peak' ? 'peak' : 'quiet'}</div>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0" style={{ width: ACTION_W }}>
              <div className="text-right leading-tight"><div className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>up to</div><div className="text-[17px] font-extrabold whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{formatPrice(g.potential, currency)}</div></div>
              {onFill && (
                <button type="button" onClick={() => onFill({ date: g.date, from: g.from, to: g.to })}
                  className="w-full text-center text-xs font-extrabold px-2 py-2 rounded-full" style={LIME}>Fill it</button>
              )}
            </div>
          </div>
        ))}
        <p className="text-[11.5px] mt-3" style={{ color: 'var(--text-subtle)' }}>
          Ranked by what a full slot could earn. Counted within your opening hours{week ? '' : ' (07:00 to 22:00 until you set them)'}. Hours already started and blocked courts are not counted.
        </p>
      </div>
    </div>
  )
}

// Offers the owner has sent. Live ones stay big with their results; closed ones from the last week shrink to a
// single line; anything older folds away behind one line, so the card is about what is on now.
function OffersCard({ offers, currency, today, onChanged, onFill }: { offers: OfferRow[]; currency: ReturnType<typeof currencyForVenueSlug>; today: string; onChanged: () => void; onFill: (g: { date: string; from: string; to: string }) => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [showEarlier, setShowEarlier] = useState(false)
  async function end(id: string) {
    setBusy(id)
    try { await fetch('/api/admin/offers/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }) } finally { setBusy(null); onChanged() }
  }
  const { live, recent, earlier } = splitOffers(offers, today)
  const ghost = { background: 'var(--bg-raised)', color: 'var(--text-primary)', border: '1px solid var(--border)' } as const
  const again = (o: OfferRow) => o.ended && o.date >= today && (
    <button type="button" onClick={() => onFill({ date: o.date, from: o.start_time.slice(0, 5), to: o.end_time.slice(0, 5) })} className="text-xs font-bold px-3 py-1.5 rounded-full shrink-0" style={ghost}>Run it again</button>
  )
  const closedRow = (o: OfferRow) => (
    <div key={o.id} className="flex items-center gap-3 py-2.5 flex-wrap" style={{ borderTop: '1px solid var(--border)' }} data-testid="offer-row-closed">
      <span className="shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-black whitespace-nowrap" style={{ background: 'var(--bg-raised)', color: 'var(--text-muted)' }}>{o.discount_percent}% off</span>
      <span className="text-[13px] font-semibold whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{formatDate(o.date)} · {fmtClockRange(o.start_time, o.end_time)}</span>
      <span className="text-[12px] min-w-0 flex-1" style={{ color: 'var(--text-muted)' }}>{closedOfferLine(o, formatPrice(o.results.earned, currency))}</span>
      {again(o)}
    </div>
  )
  const label = (text: string) => <div className="text-[10.5px] font-extrabold uppercase mt-4 mb-1" style={{ letterSpacing: '0.14em', color: 'var(--text-subtle)' }}>{text}</div>
  return (
    <div className="rounded-[20px] p-5 lg:col-span-2" style={card} data-testid="offers-card">
      <CardHeading className="">Offers you&apos;ve sent</CardHeading>
      <div className="mt-2">
        {live.length === 0 && (
          <p className="text-[13px] py-2" style={{ color: 'var(--text-muted)' }} data-testid="offers-none-live">No offer is open right now.</p>
        )}
        {live.map((o, i) => (
          <div key={o.id} className="py-3.5" style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }} data-testid="offer-row">
            <div className="flex items-start gap-3.5 flex-wrap">
              <span className="shrink-0 rounded-full px-3.5 py-2 text-[13px] font-black whitespace-nowrap" style={{ background: 'linear-gradient(160deg,#1f9a5f,#0f5c38)', color: '#ffffff' }}>{o.discount_percent}% off</span>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>{formatDate(o.date)} · {fmtClockRange(o.start_time, o.end_time)}</div>
                <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Told {o.told_count} {o.told_count === 1 ? 'player' : 'players'} · <span style={{ color: 'var(--brand-green)', fontWeight: 800 }}>Open now</span>
                </div>
              </div>
              <button type="button" disabled={busy === o.id} onClick={() => end(o.id)} className="text-xs font-bold px-3 py-1.5 rounded-full disabled:opacity-50" style={ghost}>End offer</button>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-[12px]" style={{ color: 'var(--text-muted)' }}>
              <span><b style={{ color: 'var(--text-primary)' }}>{o.results.courtsBooked}</b> {o.results.courtsBooked === 1 ? 'court' : 'courts'} booked</span>
              <span>Earned <b style={{ color: 'var(--text-primary)' }}>{formatPrice(o.results.earned, currency)}</b></span>
              <span>Given away <b style={{ color: 'var(--text-primary)' }}>{formatPrice(o.results.givenAway, currency)}</b></span>
              <span><b style={{ color: 'var(--text-primary)' }}>{o.results.newPlayers}</b> new · <b style={{ color: 'var(--text-primary)' }}>{o.results.returning}</b> returning</span>
            </div>
          </div>
        ))}
        {recent.length > 0 && (<>{label('Closed this week')}{recent.map(closedRow)}</>)}
        {earlier.length > 0 && (
          <div className="mt-2" style={{ borderTop: '1px solid var(--border)' }}>
            <button type="button" onClick={() => setShowEarlier(v => !v)} aria-expanded={showEarlier} data-testid="offers-earlier-toggle"
              className="w-full flex items-center justify-between pt-3 text-[13px] font-bold" style={{ color: 'var(--brand-primary-text)' }}>
              <span>Earlier offers ({earlier.length})</span><span>{showEarlier ? 'Hide ▴' : 'Show ▾'}</span>
            </button>
            {showEarlier && <div className="mt-1" data-testid="offers-earlier">{earlier.map(closedRow)}</div>}
          </div>
        )}
      </div>
    </div>
  )
}
