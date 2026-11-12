'use client'

import { useState } from 'react'
import type { Venue } from '@/lib/venues'
import type { OfferLite } from '@/lib/offer-rules'
import { isOpenForBooking, type VenueSettingsMap } from '@/lib/venue-settings'
import { dealAt, dealLabel, formatKm, rankNearby, type LatLng } from '@/lib/nearby'
import { localDateStr } from '@/lib/utils'

type Phase = 'ask' | 'locating' | 'list' | 'denied'
type Filter = 'all' | 'deal' | 'open'
const SHOWN = 8

const card = { background: 'var(--bg-surface)', border: '1px solid var(--border)' } as const

// "Clubs near you". The phone's position is read once, here, and used only to sort the
// list: it is held in this component's state and never sent anywhere or stored.
export default function NearMe({ venues, courtCounts, settings, offers, homeSlug, onPick, onFallback, onClose }: {
  venues: Venue[]
  courtCounts: Record<string, number>
  settings: VenueSettingsMap
  offers: OfferLite[]
  homeSlug: string | null
  onPick: (v: Venue) => void
  onFallback: () => void
  onClose: () => void
}) {
  const [phase, setPhase] = useState<Phase>('ask')
  const [pos, setPos] = useState<LatLng | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [all, setAll] = useState(false)

  const locate = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { setPhase('denied'); return }
    setPhase('locating')
    navigator.geolocation.getCurrentPosition(
      p => { setPos({ lat: p.coords.latitude, lng: p.coords.longitude }); setPhase('list') },
      () => setPhase('denied'),
      { timeout: 10000, maximumAge: 300000 },
    )
  }

  const nowMs = Date.now(), today = localDateStr()
  const items = venues.map(v => {
    return { v, slug: v.slug, lat: v.lat, lng: v.lng, approx: v.approx, bookable: isOpenForBooking(settings, v.slug) && (courtCounts[v.slug] ?? 0) > 0 }
  })
  const ranked = pos ? rankNearby(items, pos).map(r => ({ ...r, deal: dealAt(offers, r.slug, nowMs) })) : []
  const rows = ranked.filter(r => filter === 'all' || (filter === 'deal' ? !!r.deal : r.bookable))
  const shown = all || filter !== 'all' ? rows : rows.slice(0, SHOWN)

  const wrap = (children: React.ReactNode) => (
    <div className="animate-fade-in" data-testid="near-me">
      <button type="button" onClick={onClose} className="text-xs font-bold mb-4" style={{ color: 'var(--brand-primary-text)' }}>← Back</button>
      {children}
    </div>
  )

  if (phase === 'ask' || phase === 'locating' || phase === 'denied') {
    return (
      wrap(<>
        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Find a club near you</h2>
        <div className="rounded-2xl p-5 mt-4" style={card}>
          {phase === 'denied' ? (
            <>
              <div className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>We couldn&apos;t get your location</div>
              <p className="text-sm mt-1.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>You may have said no, or your phone has location switched off. You can allow it in your browser&apos;s settings and try again, or pick a country and city instead.</p>
            </>
          ) : (
            <>
              <div className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>📍 Use your location?</div>
              <p className="text-sm mt-1.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                We&apos;ll use it once, on your phone, to put the closest clubs first. <b style={{ color: 'var(--text-primary)' }}>We don&apos;t save it or share it.</b>
              </p>
            </>
          )}
          <button type="button" onClick={locate} disabled={phase === 'locating'} className="w-full rounded-xl py-3 mt-4 text-sm font-extrabold disabled:opacity-60" style={{ background: 'var(--brand-primary)', color: 'var(--brand-primary-on)' }}>
            {phase === 'locating' ? 'Finding clubs near you…' : phase === 'denied' ? 'Try again' : 'Use my location'}
          </button>
          <button type="button" onClick={onFallback} className="w-full py-2.5 mt-1.5 text-sm font-bold" style={{ color: 'var(--text-muted)' }}>Choose a country and city instead</button>
        </div>
      </>)
    )
  }

  return (
    wrap(<>
      <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Clubs near you</h2>
      <div className="text-xs mt-0.5 flex items-center gap-1.5" style={{ color: 'var(--text-subtle)' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand-green)', display: 'inline-block' }} />
        Using your current location ·{' '}
        <button type="button" onClick={() => { setPos(null); setPhase('ask') }} className="font-bold" style={{ color: 'var(--brand-primary-text)' }}>Change</button>
      </div>

      <div className="flex gap-2 mt-3.5 mb-3 flex-wrap" role="group" aria-label="Filter clubs">
        {([['all', 'All'], ['deal', '🏷️ Deals'], ['open', 'Open for booking']] as [Filter, string][]).map(([k, label]) => (
          <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} className="rounded-full px-3 py-1.5 text-xs font-extrabold"
            style={filter === k ? { background: 'var(--brand-primary-muted)', border: '1px solid var(--brand-primary)', color: 'var(--brand-primary-text)' } : { background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>{label}</button>
        ))}
      </div>

      <div className="space-y-2.5">
        {shown.map(r => (
          <button key={r.slug} type="button" data-testid="near-club" disabled={!r.bookable}
            onClick={() => onPick(r.v)} className="w-full text-left rounded-2xl p-3.5 flex gap-3 items-start" style={{ ...card, opacity: r.bookable ? 1 : 0.55, cursor: r.bookable ? 'pointer' : 'not-allowed' }}>
            <span className="shrink-0 w-[54px] text-center rounded-xl py-2" style={{ background: 'var(--bg-raised)' }}>
              {r.km !== null && r.precise ? (
                <><b className="block text-[17px]" style={{ fontFamily: 'var(--font-display), Manrope, sans-serif', color: 'var(--text-primary)' }}>{formatKm(r.km)}</b><span className="text-[10.5px]" style={{ color: 'var(--text-subtle)' }}>km</span></>
              ) : (
                <><b className="block text-[15px]">📍</b><span className="text-[10px] leading-tight block px-0.5" style={{ color: 'var(--text-subtle)' }}>In {r.v.region}</span></>
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{r.v.name}</span>
              <span className="block text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{r.v.address.split(',').slice(0, 2).join(',')}</span>
              <span className="flex flex-wrap gap-1.5 mt-2">
                {r.bookable
                  ? <span className="text-[10.5px] font-extrabold rounded-full px-2 py-0.5" style={{ background: 'var(--brand-green-muted)', color: 'var(--brand-green)' }}>Open for booking</span>
                  : <span className="text-[10.5px] font-extrabold rounded-full px-2 py-0.5" style={{ background: 'var(--bg-raised)', color: 'var(--text-subtle)' }}>Courts coming soon</span>}
                {r.deal && <span data-testid="near-deal" className="text-[10.5px] font-extrabold rounded-full px-2 py-0.5" style={{ background: 'var(--brand-yellow-muted)', color: 'var(--brand-yellow)' }}>🏷️ {dealLabel(r.deal, today)}</span>}
                {r.slug === homeSlug && <span className="text-[10.5px] font-extrabold rounded-full px-2 py-0.5" style={{ background: 'var(--brand-primary-muted)', color: 'var(--brand-primary-text)' }}>Your club</span>}
              </span>
            </span>
          </button>
        ))}
        {shown.length === 0 && <p className="text-sm py-6 text-center" style={{ color: 'var(--text-muted)' }}>{filter === 'deal' ? 'No deals on right now.' : 'No clubs to show.'}</p>}
      </div>
      {!all && filter === 'all' && rows.length > SHOWN && (
        <button type="button" onClick={() => setAll(true)} className="w-full py-3 mt-2 text-sm font-bold" style={{ color: 'var(--brand-primary-text)' }}>Show all {rows.length} clubs</button>
      )}
      <button type="button" onClick={onFallback} className="w-full py-3 mt-1 text-sm font-bold" style={{ color: 'var(--text-muted)' }}>Choose a country and city instead</button>
    </>)
  )
}
