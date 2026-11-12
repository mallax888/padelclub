'use client'

import { useEffect, useMemo, useState } from 'react'
import { formatDate } from '@/lib/utils'
import { currencyForVenueSlug, formatPrice } from '@/lib/currency'
import { getVenue } from '@/lib/venues'
import { MAX_WINDOW_MIN, MIN_WINDOW_MIN, OFFER_PERCENTS } from '@/lib/offer-rules'
import { toMin } from '@/lib/waitlist-rules'

const display = { fontFamily: 'var(--font-display), Manrope, sans-serif' } as const
type Preview = { courtsFree: number; listTotal: number; offerTotal: number; recipients: { past_players: number; home_club: number } }
type Audience = 'past_players' | 'home_club'

const pad = (n: number) => String(n).padStart(2, '0')
const halfHours = (from: string, to: string): string[] => {
  const out: string[] = []
  for (let m = toMin(from); m <= toMin(to); m += 30) out.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`)
  return out
}

// The owner's "fill it" dialog: pick the discount, who hears about it, see what
// it would earn, and send. The server checks everything again.
export default function OfferSheet({ venueSlug, date, from, to, onClose, onSent }: {
  venueSlug: string; date: string; from: string; to: string; onClose: () => void; onSent: () => void
}) {
  const times = useMemo(() => halfHours(from, to), [from, to])
  const [start, setStart] = useState(from)
  const [end, setEnd] = useState(() => {
    const cap = toMin(from) + MAX_WINDOW_MIN
    return toMin(to) > cap ? `${pad(Math.floor(cap / 60))}:${pad(cap % 60)}` : to
  })
  const [percent, setPercent] = useState<number>(20)
  const [audience, setAudience] = useState<Audience>('past_players')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const minutes = toMin(end) - toMin(start)
  const windowOk = minutes >= MIN_WINDOW_MIN && minutes <= MAX_WINDOW_MIN
  const currency = currencyForVenueSlug(venueSlug)
  const clubName = getVenue(venueSlug).name

  useEffect(() => {
    if (!windowOk) { setPreview(null); return }
    let live = true
    const q = new URLSearchParams({ venue: venueSlug, date, start, end, percent: String(percent) })
    fetch(`/api/admin/offers/preview?${q}`).then(r => r.json()).then(d => { if (live && !d.error) setPreview(d) }).catch(() => {})
    return () => { live = false }
  }, [venueSlug, date, start, end, percent, windowOk])

  const reach = preview ? preview.recipients[audience] : null

  async function send() {
    setSending(true); setError(null)
    try {
      const res = await fetch('/api/admin/offers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venueSlug, date, startTime: start, endTime: end, percent, audience }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d.error ?? 'Something went wrong. Please try again.'); setSending(false); return }
      onSent()
    } catch {
      setError('Something went wrong. Please try again.'); setSending(false)
    }
  }

  const select = 'rounded-lg px-2 py-1.5 text-sm font-bold'
  const selectStyle = { background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' } as const

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }} role="dialog" aria-modal="true" aria-label="Fill empty courts" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl p-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-extrabold uppercase" style={{ letterSpacing: '0.14em', color: 'var(--text-subtle)' }}>Fill my empty courts</div>
            <h3 className="text-xl font-extrabold mt-1" style={{ ...display, color: 'var(--text-primary)' }}>{formatDate(date)}</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{clubName}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-xl leading-none px-2" style={{ color: 'var(--text-muted)' }}>×</button>
        </div>

        <div className="mt-4 flex items-center gap-2 flex-wrap text-sm" style={{ color: 'var(--text-muted)' }}>
          <label className="flex items-center gap-1.5">From
            <select aria-label="From" className={select} style={selectStyle} value={start} onChange={e => setStart(e.target.value)}>
              {times.slice(0, -1).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1.5">to
            <select aria-label="To" className={select} style={selectStyle} value={end} onChange={e => setEnd(e.target.value)}>
              {times.slice(1).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
        </div>
        {!windowOk && <p className="text-xs mt-2" style={{ color: 'var(--brand-crimson)' }}>Choose between {MIN_WINDOW_MIN / 60} and {MAX_WINDOW_MIN / 60} hours.</p>}

        <div className="text-[11px] font-extrabold uppercase mt-5 mb-2" style={{ letterSpacing: '0.14em', color: 'var(--text-subtle)' }}>Discount</div>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Discount">
          {OFFER_PERCENTS.map(p => (
            <button key={p} type="button" role="radio" aria-checked={percent === p} onClick={() => setPercent(p)}
              className="rounded-xl py-2.5 text-lg font-extrabold"
              style={percent === p ? { background: 'var(--brand-primary)', color: '#fff', border: '1px solid var(--brand-primary)' } : { background: 'var(--bg-raised)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
              {p}%
            </button>
          ))}
        </div>

        <div className="text-[11px] font-extrabold uppercase mt-5 mb-2" style={{ letterSpacing: '0.14em', color: 'var(--text-subtle)' }}>Who hears about it</div>
        <div className="space-y-2" role="radiogroup" aria-label="Who hears about it">
          {([
            ['past_players', 'Past players', 'Booked at your club in the last 60 days', preview?.recipients.past_players],
            ['home_club', 'Everyone with this as their home club', 'Includes people who haven’t booked yet', preview?.recipients.home_club],
          ] as const).map(([key, title, sub, n]) => (
            <button key={key} type="button" role="radio" aria-checked={audience === key} onClick={() => setAudience(key)}
              className="w-full text-left rounded-xl px-3 py-2.5 flex items-center justify-between gap-3"
              style={audience === key ? { background: 'var(--brand-primary-muted)', border: '1px solid var(--brand-primary)' } : { background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
              <span>
                <span className="block text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>{title}</span>
                <span className="block text-[11.5px]" style={{ color: 'var(--text-muted)' }}>{sub}</span>
              </span>
              <span className="text-sm font-extrabold tabular-nums" style={{ color: 'var(--text-primary)' }}>{n === undefined ? '…' : n}</span>
            </button>
          ))}
        </div>

        <div className="rounded-xl px-3 py-2.5 mt-5" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
          <div className="text-[11px] font-extrabold uppercase" style={{ letterSpacing: '0.14em', color: 'var(--text-subtle)' }}>What they&apos;ll see</div>
          <p className="text-[13px] mt-1" style={{ color: 'var(--text-primary)' }}>
            <b>{percent}% off courts</b> · {formatDate(date)}, {start}–{end} at {clubName}. Book before the offer closes.
          </p>
        </div>

        {preview && windowOk && (
          <p className="text-xs mt-3" data-testid="offer-estimate" style={{ color: 'var(--text-muted)' }}>
            {preview.courtsFree === 0
              ? 'No courts are free in these hours, so there is nothing to fill.'
              : <>{preview.courtsFree} {preview.courtsFree === 1 ? 'court is' : 'courts are'} free. If they all fill you&apos;d earn <b style={{ color: 'var(--text-primary)' }}>{formatPrice(preview.offerTotal, currency)}</b> instead of nothing (list price {formatPrice(preview.listTotal, currency)}).</>}
          </p>
        )}
        <p className="text-[11.5px] mt-2" style={{ color: 'var(--text-subtle)' }}>Members with a better discount keep theirs; nobody gets both. The offer closes 2 hours before it starts.</p>

        {error && <p className="text-sm mt-3" role="alert" style={{ color: 'var(--brand-crimson)' }}>{error}</p>}

        <div className="flex gap-2 mt-5">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl py-2.5 text-sm font-bold" style={{ background: 'var(--bg-raised)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>Cancel</button>
          <button type="button" onClick={send} disabled={sending || !windowOk || preview?.courtsFree === 0 || reach === 0}
            className="flex-[2] rounded-xl py-2.5 text-sm font-extrabold disabled:opacity-50" style={{ background: 'var(--brand-primary)', color: '#fff' }}>
            {sending ? 'Sending…' : reach === null ? 'Send offer' : `Send to ${reach} ${reach === 1 ? 'player' : 'players'}`}
          </button>
        </div>
      </div>
    </div>
  )
}
