'use client'

import Link from 'next/link'
import { GO } from '@/lib/accent'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import OfferSheet from '@/components/admin/OfferSheet'
import { formatPrice, type CurrencyCode } from '@/lib/currency'
import type { CourtDay, CourtDayCell, CourtDayRow } from '@/lib/court-day'
import { fmtClockRange, fmtHour, fmtMinutes } from '@/lib/clock'
import { bookingsWord, clock12, comparison, courtAt, gapSentence, hhmm, initialsOf, nextBookings, slotChips, type MapBooking } from '@/lib/club-map'
import { MIN_LEAD_HOURS } from '@/lib/offer-rules'

// "Your club right now": one calm tile per court, who is on it, what is left to sell, and a thin strip for the
// rest of the day. A slider moves the whole map to any time of day. Tap a court for its briefing (a panel under
// the map on a computer, a sheet on a phone).
type CourtProp = { id: string; name: string; row: CourtDayRow; today: number; lastWeek: number }
const card = { background: 'var(--bg-surface)', border: '1px solid var(--border)' } as const
const money = (n: number, c: CurrencyCode) => formatPrice(n, c).replace(/\.00$/, '')

function cellStyle(c: CourtDayCell): React.CSSProperties {
  if (c.state === 'booked') return { background: 'var(--brand-primary)', opacity: c.past ? 0.38 : 1 }
  if (c.state === 'blocked') return { background: 'var(--brand-crimson-muted)', border: '1px solid var(--brand-crimson)', opacity: c.past ? 0.55 : 1 }
  return { background: 'var(--bg-raised)', opacity: c.past ? 0.5 : 1 }
}

function Avatars({ people }: { people: string[] }) {
  return (
    <span className="flex shrink-0" aria-hidden>
      {people.slice(0, 4).map((p, i) => (
        <span key={i} className="inline-flex items-center justify-center rounded-full text-[10px] font-black"
          style={{ width: 30, height: 30, marginLeft: i === 0 ? 0 : -7, background: 'var(--bg-surface)', color: 'var(--brand-primary-text)', border: '2px solid var(--brand-primary-muted)',
            boxShadow: i === 0 ? '0 0 0 2px var(--bg-surface), 0 0 0 4px var(--brand-yellow)' : '0 0 0 2px var(--bg-surface)' }}>{initialsOf(p)}</span>
      ))}
    </span>
  )
}

const tone = {
  playing: { bg: 'var(--brand-primary-muted)', border: 'var(--brand-primary)', text: 'var(--brand-primary-text)' },
  free: { bg: 'var(--brand-green-muted)', border: 'var(--brand-green)', text: 'var(--brand-green)' },
  blocked: { bg: 'var(--brand-crimson-muted)', border: 'var(--brand-crimson)', text: 'var(--brand-crimson)' },
} as const

export default function ClubMap({ venueSlug, date, courts, day, bookings, nowMinutes, currency, showMoney, offersOn, bounds, boardHref, weekdayShort, bookingsToday, bookingsLastWeek, takings, fill, aside, yesterday, stillToPlay, bookedPct, unpaidChase }: {
  venueSlug: string; date: string; courts: CourtProp[]; day: CourtDay; bookings: MapBooking[]; nowMinutes: number
  currency: CurrencyCode; showMoney: boolean; offersOn: boolean; bounds: { from: string; to: string } | null; boardHref: string
  weekdayShort: string; bookingsToday: number; bookingsLastWeek: number; takings: number
  fill: React.ReactNode
  // the cards that sit beside the big blue card on a computer (Needs attention, Next up), and the Yesterday line inside it
  aside: React.ReactNode; yesterday: React.ReactNode; stillToPlay: number; bookedPct: number | null; unpaidChase: number | null
}) {
  const router = useRouter()
  // The time on show. Until someone moves the slider it simply follows the clock, so when the page refreshes itself each
  // minute it stays on "now" instead of being left on the minute it first opened.
  const [picked, setPicked] = useState<number | null>(null)
  const at = picked ?? nowMinutes
  const setAt = (m: number) => setPicked(m === nowMinutes ? null : m)
  const [sel, setSel] = useState<string | null>(null)
  const [offer, setOffer] = useState<{ from: string; to: string } | null>(null)
  const [sent, setSent] = useState<string[]>([])
  // Phone: while the map is on screen the time slider rides just above the bottom bar, so you can drag it without scrolling back.
  const rootRef = useRef<HTMLDivElement>(null)
  const slotRef = useRef<HTMLDivElement>(null)
  const [pinned, setPinned] = useState(false)
  const [slotH, setSlotH] = useState(0)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const update = () => {
      const root = rootRef.current, slot = slotRef.current
      if (!root || !slot || !mq.matches) { setPinned(false); return }
      const vh = window.innerHeight
      const r = root.getBoundingClientRect(), sl = slot.getBoundingClientRect()
      setPinned(sl.bottom > vh - 84 && r.top < vh - 260)
      setSlotH(h => (h === sl.height || pinnedRef.current ? h : sl.height))
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update) }
  }, [])
  const pinnedRef = useRef(false)
  pinnedRef.current = pinned
  const n = day.endHour - day.firstHour
  const isNow = at === nowMinutes
  const states = useMemo(() => new Map(courts.map(c => [c.id, courtAt(bookings, c.id, at)])), [courts, bookings, at])
  const playing = courts.filter(c => states.get(c.id)?.state === 'playing').length
  const free = courts.filter(c => states.get(c.id)?.state === 'free').length
  const chips = slotChips(nowMinutes, day.firstHour, day.endHour)
  const nowPct = n > 0 ? Math.min(100, Math.max(0, ((nowMinutes / 60 - day.firstHour) / n) * 100)) : 0
  const potential = takings + day.openValue
  const selected = courts.find(c => c.id === sel) ?? null
  const none = day.openNow === 0
  const summary = none ? (day.finished ? 'Today is finished' : 'Sold out from now') : `${day.openNow} court-${day.openNow === 1 ? 'hour' : 'hours'} open from now${showMoney && day.openValue > 0 ? ` · ${money(day.openValue, currency)} still to win` : ''}`
  const ticks = Array.from({ length: n }, (_, i) => day.firstHour + i).filter(h => h % 3 === 0)

  const briefing = ({ c, testid }: { c: CourtProp; testid: string }) => {
    const sfx = testid.endsWith('-m') ? '-m' : '' // the computer panel and the phone sheet both exist in the page, so their test ids differ
    const st = states.get(c.id)!
    const r = c.row
    const dayBlocks: { l: number; w: number; kind: 'b' | 'bp' | 'gap'; label: string }[] = []
    for (let i = 0; i < r.cells.length; i++) {
      const cell = r.cells[i]
      if (cell.state === 'open' && cell.past) continue
      const kind = cell.state === 'booked' ? (cell.past ? 'bp' : 'b') : cell.state === 'open' ? 'gap' : 'bp'
      let j = i
      while (j + 1 < r.cells.length && r.cells[j + 1].state === cell.state && r.cells[j + 1].past === cell.past) j++
      const range = kind === 'gap' ? r.openRanges.find(g => g.from === hhmm(cell.hour * 60)) : null
      dayBlocks.push({ l: (i / n) * 100, w: ((j - i + 1) / n) * 100, kind, label: range ? (showMoney && range.value > 0 ? money(range.value, currency) : `${range.hours}h`) : '' })
      i = j
    }
    const upcoming = nextBookings(bookings, c.id, at)
    const headline = `${c.name} has ${bookingsWord(c.today)} today, ${comparison(c.today - c.lastWeek, weekdayShort)}. ${gapSentence(r, day.finished)}`
    const statusLine = st.state === 'playing' ? `${st.who ?? 'A booking'} until ${fmtMinutes(st.until!)}` : st.state === 'blocked' ? `Blocked until ${fmtMinutes(st.until!)}` : st.next ? `Next booking ${fmtMinutes(st.next.start)}${st.next.who ? ` · ${st.next.who}` : ''}` : 'Nothing more today'
    return (
      <div data-testid={testid}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[22px] font-black leading-tight" style={{ letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>{c.name}</div>
            <div className="text-[12.5px] mt-1" style={{ color: 'var(--text-muted)' }}><b style={{ color: tone[st.state].text }}>● {st.state === 'playing' ? (isNow ? 'LIVE' : 'PLAYING') : st.state === 'blocked' ? 'BLOCKED' : isNow ? 'FREE NOW' : 'FREE'}</b> · {statusLine}</div>
          </div>
          <button type="button" onClick={() => setSel(null)} aria-label="Close" className="text-lg px-2 py-1" style={{ color: 'var(--text-subtle)' }}>✕</button>
        </div>
        <p className="text-[17px] font-black leading-snug mt-3" style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }} data-testid={`court-headline${sfx}`}>{headline}</p>

        <div className="relative mt-4 rounded-[9px]" style={{ height: 28, background: 'var(--bg-raised)' }} aria-hidden>
          {dayBlocks.map((b, i) => (
            <div key={i} className="absolute top-0 bottom-0 rounded-[7px] flex items-center justify-center text-[11px] font-black"
              style={{ left: `${b.l}%`, width: `${b.w}%`, ...(b.kind === 'gap' ? { background: 'var(--brand-yellow-muted)', border: '1.5px dashed var(--brand-yellow)', color: 'var(--open-text)' } : { background: 'var(--brand-primary)', opacity: b.kind === 'bp' ? 0.35 : 1 }) }}>{b.label}</div>
          ))}
        </div>
        <div className="relative text-[10px] mt-1" style={{ height: 14, color: 'var(--text-subtle)' }} aria-hidden>
          {ticks.map(h => <span key={h} className="absolute" style={{ left: `${((h - day.firstHour) / n) * 100}%` }}>{fmtHour(`${String(h).padStart(2, '0')}:00`)}</span>)}
        </div>

        {r.openRanges.slice(0, 3).map(g => {
          const lead = g.from.length === 5 ? parseInt(g.from.slice(0, 2), 10) * 60 - nowMinutes : 0
          const can = showMoney && offersOn && lead >= MIN_LEAD_HOURS * 60
          const done = sent.includes(`${c.id}-${g.from}`)
          return (
            <div key={g.from} className="flex items-center gap-3 py-3" style={{ borderTop: '1px solid var(--border)' }} data-testid={`court-gap${sfx}`}>
              <span aria-hidden className="inline-flex items-center justify-center rounded-[11px] font-black shrink-0" style={{ width: 36, height: 36, background: 'var(--brand-yellow-muted)', color: 'var(--open-text)' }}>{showMoney ? '$' : '◔'}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-black" style={{ color: 'var(--text-primary)' }}>{fmtClockRange(g.from, g.to)} is open{showMoney && g.value > 0 ? ` · ${money(g.value, currency)}` : ''}</span>
                <span className="block text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{can || done ? 'Nobody has booked it. Offer it to players who have played here before.' : lead < MIN_LEAD_HOURS * 60 ? `Starts in under ${MIN_LEAD_HOURS} hours, too late to send an offer.` : 'Nobody has booked it.'}</span>
              </span>
              {done ? <span className="text-[12px] font-extrabold" style={{ color: 'var(--brand-primary-text)' }}>✓ Offer sent</span>
                : can ? <button type="button" onClick={() => setOffer({ from: g.from, to: g.to })} data-testid={`court-offer${sfx}`} className="shrink-0 rounded-[11px] px-3.5 text-[12.5px] font-extrabold" style={{ minHeight: 40, background: 'var(--brand-primary)', color: 'var(--brand-primary-on, #fff)' }}>Offer a discount</button> : null}
            </div>
          )
        })}

        <div className="flex items-center gap-3 py-3" style={{ borderTop: '1px solid var(--border)' }}>
          <span aria-hidden className="inline-flex items-center justify-center rounded-[11px] font-black shrink-0" style={{ width: 36, height: 36, background: 'var(--brand-primary-muted)', color: 'var(--brand-primary-text)' }}>▢</span>
          <span className="min-w-0 flex-1 text-[13px]" style={{ color: 'var(--text-primary)' }}><b>Not selling it?</b> Keep it free for maintenance or coaching.</span>
          <Link href={`/admin?tab=bookings&venue=${encodeURIComponent(venueSlug)}&block=${encodeURIComponent(c.id)}`} data-testid={`court-block${sfx}`} className="shrink-0 rounded-[11px] px-3.5 text-[12.5px] font-extrabold inline-flex items-center" style={{ minHeight: 40, border: '1.5px solid var(--border)', color: 'var(--text-primary)' }}>Block the court</Link>
        </div>

        <div className="text-[11px] font-extrabold uppercase mt-2 mb-1" style={{ letterSpacing: '0.12em', color: 'var(--text-subtle)' }}>Next on {c.name}</div>
        {upcoming.length === 0 ? <div className="py-3 text-[13px]" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>Nothing more booked today.</div>
          : upcoming.map(b => (
            <div key={b.id} className="flex items-center gap-3 py-2.5" style={{ borderTop: '1px solid var(--border)' }}>
              <span className="w-[84px] shrink-0 text-[17px] font-black" style={{ color: 'var(--text-primary)' }}>{fmtMinutes(b.start)}</span>
              <span className="min-w-0 flex-1 text-[13.5px] truncate" style={{ color: 'var(--text-primary)' }}>{b.who ?? 'Booking'} · {b.people.length} {b.people.length === 1 ? 'player' : 'players'}</span>
              <span className="text-[10.5px] font-extrabold px-2.5 py-1 rounded-full whitespace-nowrap"
                style={b.unpaid > 0 ? { background: 'var(--brand-yellow-muted)', border: '1px solid var(--brand-yellow)', color: 'var(--text-primary)' } : { background: 'var(--brand-primary-muted)', color: 'var(--brand-primary-text)' }}>{b.unpaid > 0 ? `${b.unpaid} unpaid` : 'All paid'}</span>
            </div>
          ))}
      </div>
    )
  }

  const goal = showMoney && potential > 0
  const soft = '#cfe0ff'
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:items-start" data-testid="court-day">
      {/* the day in one blue card */}
      <section className="order-1 lg:col-start-1 lg:row-start-1 rounded-[22px] p-4 lg:p-6" style={{ background: 'linear-gradient(160deg, #2c5fc4, #1d3f8d)', color: '#ffffff' }} aria-label="Today so far">
        <div className="text-[11px] font-extrabold uppercase" style={{ letterSpacing: '0.12em', color: soft }}>{isNow ? 'Today so far' : 'Your club at'}</div>
        {isNow ? (
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mt-1.5" data-testid="map-title">
            <span className="font-black leading-none text-[44px] lg:text-[56px]" style={{ letterSpacing: '-0.04em' }} data-testid="map-number">{bookingsToday}</span>
            <span className="text-[19px] font-extrabold">{bookingsToday === 1 ? 'booking' : 'bookings'}</span>
            <span className="text-[13px] font-bold rounded-full px-3 py-1" style={{ background: '#ffffff26' }} data-testid="map-compare">{comparison(bookingsToday - bookingsLastWeek, weekdayShort)}</span>
          </div>
        ) : (
          <div className="font-black leading-none mt-1.5" style={{ fontSize: 44, letterSpacing: '-0.03em' }} data-testid="map-title">{fmtMinutes(at)}</div>
        )}
        <div className="text-[12.5px] lg:text-[13px] mt-2" style={{ color: soft }} data-testid="map-sub">
          {isNow
            ? `${clock12(nowMinutes)} · ${playing} ${playing === 1 ? 'court' : 'courts'} playing · ${free} free${stillToPlay > 0 ? ` · ${stillToPlay} still to play` : ''}${bookedPct !== null ? ` · ${bookedPct}% of court-hours booked` : ''}`
            : `${playing} of ${courts.length} courts booked at ${fmtMinutes(at)}${playing === courts.length ? ': your courts are full' : ''}`}
        </div>
        {goal && (
          <div className="mt-4">
            <div className="h-[10px] rounded-full overflow-hidden" style={{ background: '#ffffff30' }} aria-hidden><div className="h-full rounded-full" style={{ width: `${Math.min(100, (takings / potential) * 100)}%`, background: '#1f9a5f' }} /></div>
            <div className="text-[13px] font-bold mt-2" style={{ color: soft }}><b className="text-[15px]" style={{ color: '#ffffff' }}>{money(takings, currency)}</b> of {money(potential, currency)} possible today</div>
          </div>
        )}
        <div className="text-[13px] font-bold mt-3" style={{ color: day.openValue > 0 ? '#ffe566' : soft }} data-testid="court-day-summary">{summary}</div>
        {unpaidChase !== null && unpaidChase > 0 && <div className="text-[13px] font-bold mt-1" style={{ color: soft }}>{unpaidChase} {unpaidChase === 1 ? 'share' : 'shares'} to chase</div>}
        {fill && <div className="mt-4 flex flex-wrap gap-2.5">{fill}</div>}
        {yesterday && <div className="mt-3 pt-3 lg:mt-4" style={{ borderTop: '1px solid #ffffff30' }}>{yesterday}</div>}
      </section>

      <div className="order-3 lg:col-start-2 lg:row-start-1 flex flex-col gap-6">{aside}</div>

      {/* the courts */}
      <section ref={rootRef} className="order-2 lg:col-span-2 lg:row-start-2" aria-label="Courts right now">
        <div className="flex items-baseline justify-between gap-3 mb-2.5 px-0.5">
          <div className="text-[11px] font-extrabold uppercase" style={{ letterSpacing: '0.14em', color: 'var(--text-subtle)' }}>Courts right now</div>
          <div className="text-[12px]" style={{ color: 'var(--text-subtle)' }}>Tap a court for its briefing</div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
          {courts.map(c => {
            const st = states.get(c.id)!
            const r = c.row
            const t = tone[st.state]
            const soldOut = r.sellable > 0 && r.openNow === 0 && !day.finished
            return (
              <div key={c.id} role="button" tabIndex={0} onClick={() => setSel(sel === c.id ? null : c.id)} onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); setSel(sel === c.id ? null : c.id) } }} data-testid="court-tile" aria-pressed={sel === c.id}
                aria-label={`${c.name}: ${st.state === 'playing' ? `${st.who ?? 'booked'} until ${fmtMinutes(st.until!)}` : st.state === 'blocked' ? 'blocked' : 'free'}${r.openNow > 0 ? `, ${r.openNow} ${r.openNow === 1 ? 'hour' : 'hours'} to sell` : ''}`}
                className="text-left rounded-[20px] p-4 lg:p-5 transition-shadow cursor-pointer"
                style={{ background: 'var(--bg-surface)', border: sel === c.id ? '2px solid var(--brand-primary)' : '2px solid var(--border)', boxShadow: sel === c.id ? '0 0 0 4px var(--brand-primary-muted)' : 'none' }}>
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[19px] sm:text-[21px] font-black shrink-0 whitespace-nowrap" style={{ letterSpacing: '-0.02em', color: 'var(--text-primary)' }} data-testid="court-name">{c.name}</span>
                  <span className="text-[10.5px] font-black whitespace-nowrap" style={{ letterSpacing: '0.08em', color: t.text }}>● {st.state === 'playing' ? (isNow ? 'LIVE' : <><span className="sm:hidden">BUSY</span><span className="hidden sm:inline">PLAYING</span></>) : st.state === 'blocked' ? 'BLOCKED' : 'FREE'}</span>
                </span>
                <span className="flex items-center gap-2.5 mt-3 min-h-[38px]">
                  {st.state === 'playing' && st.people.length > 0 && <Avatars people={st.people} />}
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-extrabold truncate" style={{ color: 'var(--text-primary)' }}>
                      {st.state === 'playing' ? (st.who ?? 'Booked') : st.state === 'blocked' ? 'Blocked' : st.next ? `${st.next.who ?? 'Next booking'}` : 'Free'}
                    </span>
                    <span className="block text-[12px]" style={{ color: 'var(--text-muted)' }}>
                      {st.state === 'playing' || st.state === 'blocked' ? `until ${fmtMinutes(st.until!)}` : st.next ? `next ${fmtMinutes(st.next.start)}` : 'nothing more today'}
                    </span>
                  </span>
                </span>
                <span className="grid gap-[3px] mt-3" style={{ gridTemplateColumns: `repeat(${Math.max(n, 1)}, minmax(0,1fr))` }} aria-hidden>
                  {r.cells.map(cell => <i key={cell.hour} style={{ height: 12, borderRadius: 4, display: 'block', ...cellStyle(cell) }} />)}
                </span>
                <span className="flex mt-3.5">
                  {r.openNow > 0 ? (
                    <span className="flex w-full items-center justify-between gap-3">
                    <span className="min-w-0" data-testid="court-coin">
                      {showMoney && r.openValue > 0 ? (
                        <>
                          <span className="block text-[20px] sm:text-[24px] font-black leading-none" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{money(r.openValue, currency)}</span>
                          <span className="block text-[11.5px] mt-1" style={{ color: 'var(--text-muted)' }}>{r.openNow} {r.openNow === 1 ? 'hour' : 'hours'} still to sell</span>
                        </>
                      ) : (
                        <span className="block text-[12.5px] font-extrabold" style={{ color: 'var(--text-primary)' }}>{r.openNow} {r.openNow === 1 ? 'hour' : 'hours'} open</span>
                      )}
                    </span>
                    {showMoney && offersOn && (
                      <button type="button" data-testid="court-fill" onClick={e => { e.stopPropagation(); setSel(c.id) }} className="hidden sm:inline-flex shrink-0 rounded-full px-4 py-2 text-[12px] font-black"
                        style={GO}>Fill it</button>
                    )}
                    </span>
                  ) : soldOut ? (
                    <span className="text-[10.5px] font-black rounded-full px-2.5 py-1" style={{ background: 'var(--brand-green-muted)', color: 'var(--brand-green)', letterSpacing: '0.04em' }} data-testid="court-soldout">SOLD OUT ✓</span>
                  ) : (
                    <span className="text-[11px] font-bold py-1" style={{ color: 'var(--text-subtle)' }}>{day.finished ? 'Done for today' : r.sellable === 0 ? 'Not on sale' : ''}&nbsp;</span>
                  )}
                </span>
              </div>
            )
          })}
        </div>

        {/* the time slider */}
        <div ref={slotRef} style={pinned && slotH ? { height: slotH } : undefined}>
        <div className={pinned ? 'px-4 pt-3 pb-2 rounded-[20px] lg:rounded-none' : 'pt-4'} data-testid="time-scrub" data-pinned={pinned ? 'true' : 'false'}
          style={pinned ? { position: 'fixed', left: 12, right: 12, bottom: 'calc(80px + env(safe-area-inset-bottom))', zIndex: 30, background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: '0 10px 30px rgba(0,0,0,0.28)' } : undefined}>
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <span className="text-[12px] font-extrabold" style={{ color: 'var(--text-muted)' }}>Drag the ball to see another time today</span>
            <span className="flex gap-1.5 flex-wrap justify-end">
              <button type="button" onClick={() => setAt(nowMinutes)} data-testid="time-now" aria-pressed={isNow} className="text-[11.5px] font-extrabold rounded-full px-2.5 py-1"
                style={isNow ? { background: 'var(--brand-primary)', color: 'var(--brand-primary-on, #fff)', border: '1.5px solid var(--brand-primary)' } : { color: 'var(--text-muted)', border: '1.5px solid var(--border)' }}>Now</button>
              {chips.map(m => (
                <button key={m} type="button" onClick={() => setAt(m)} data-testid="time-chip" aria-pressed={at === m} className="hidden sm:inline-block text-[11.5px] font-extrabold rounded-full px-2.5 py-1"
                  style={at === m ? { background: 'var(--brand-primary)', color: 'var(--brand-primary-on, #fff)', border: '1.5px solid var(--brand-primary)' } : { color: 'var(--text-muted)', border: '1.5px solid var(--border)' }}>{fmtMinutes(m)}</button>
              ))}
            </span>
          </div>
          <input type="range" className="time-slider" data-testid="time-slider" aria-label="Time of day" min={day.firstHour * 60} max={day.endHour * 60 - 15} step={15} value={at}
            onChange={e => setAt(Number(e.target.value))} style={{ background: `linear-gradient(90deg, var(--brand-primary-muted) ${nowPct}%, var(--bg-raised) ${nowPct}%)` }} />
          <div className="relative text-[10.5px] mt-1.5" style={{ height: 14, color: 'var(--text-subtle)' }} aria-hidden>
            {ticks.map(h => <span key={h} className="absolute -translate-x-1/2" style={{ left: `${((h - day.firstHour) / n) * 100}%` }}>{fmtHour(`${String(h).padStart(2, '0')}:00`)}</span>)}
          </div>
        </div>
        </div>

        {/* computer: the briefing opens under the courts */}
        <div className="hidden lg:block">
          {selected && <div className="mt-4 rounded-[20px] px-5 pt-5 pb-3" style={{ ...card, background: 'linear-gradient(180deg, var(--brand-primary-muted), var(--bg-surface) 180px)' }}>{briefing({ c: selected, testid: 'court-briefing' })}</div>}
        </div>
        {/* phone: the briefing is a sheet */}
        {selected && (
          <div className="lg:hidden fixed inset-0 z-[70] flex items-end" role="dialog" aria-modal="true" aria-label={`${selected.name} briefing`}>
            <div className="absolute inset-0" style={{ background: 'rgba(8,10,14,0.55)' }} onClick={() => setSel(null)} />
            <div className="relative w-full max-h-[85vh] overflow-y-auto rounded-t-[26px] px-4 pt-3" style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border)', paddingBottom: 'calc(22px + env(safe-area-inset-bottom))' }}>
              <div className="mx-auto mb-3" style={{ width: 42, height: 4, borderRadius: 4, background: 'var(--text-subtle)', opacity: 0.6 }} />
              {briefing({ c: selected, testid: 'court-briefing-m' })}
            </div>
          </div>
        )}
      </section>

      {offer && (
        <OfferSheet venueSlug={venueSlug} date={date} from={offer.from} to={offer.to} bounds={bounds ?? undefined} onClose={() => setOffer(null)}
          onSent={() => { setSent(s => [...s, `${sel}-${offer.from}`]); setOffer(null); router.refresh() }} />
      )}
    </div>
  )
}
