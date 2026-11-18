import Link from 'next/link'
import { VENUES, getVenue } from '@/lib/venues'
import { currencyForRegion, formatPrice } from '@/lib/currency'
import { buildBookingIcsDataUri } from '@/lib/ics'
import { fmtClock, fmtHour, fmtUntil } from '@/lib/clock'
import { countdownLabel, dayWord, greetingFor, levelText, mapsUrl, nextOccurrence, shareChips, usualLink, type HomeBooking, type Usual } from '@/lib/home-rules'
import { Avatars, CourtTile } from '@/components/booking/BookingTicket'

const card = { background: 'var(--bg-surface)', border: '1px solid var(--border)' } as const
const label = { letterSpacing: '0.14em', color: 'var(--text-subtle)' } as const
const SOFT = '#cfe0ff'
const TICKET = 'linear-gradient(160deg, #2c5fc4, #1d3f8d)'
const BALL = '#d4f53c'
const INK = '#17240a'
const dateParts = (date: string) => {
  const d = new Date(date + 'T12:00:00Z')
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-NZ', { timeZone: 'UTC', ...o }).format(d)
  return { weekday: f({ weekday: 'short' }), day: f({ day: 'numeric' }), month: f({ month: 'short' }), long: f({ weekday: 'long', day: 'numeric', month: 'long' }), short: `${f({ weekday: 'short' })} ${f({ day: 'numeric' })} ${f({ month: 'short' })}` }
}
const venueName = (slug: string) => VENUES.find(v => v.slug === slug)?.name ?? slug

type Game = { id: string; date: string; start_time: string; venue_slug: string; court: string | null; skill_min: number; skill_max: number; spotsTotal: number; filled: number; ratings: number[] }
type Offer = { venue_slug: string; date: string; start_time: string; end_time: string; discount_percent: number; closes_at?: string | null }

export default function HomeView({ name, fullName, homeSlug, tz, nowMs, next, shares, usual, games, offer, saved, month }: {
  name: string | null; fullName?: string | null; homeSlug: string | null; tz: string; nowMs: number
  next: (HomeBooking & { id: string }) | null
  shares: { paid: string[]; waiting: string[] }
  usual: Usual | null; games: Game[]; offer: Offer | null; saved: number
  // The "Your month" tiles; null when there is nothing to show yet (a brand-new player).
  month: { games: number; people: number; weeks: number } | null
}) {
  const hour = Number(new Intl.DateTimeFormat('en-NZ', { timeZone: tz, hour: 'numeric', hour12: false }).format(new Date(nowMs)).replace(/\D/g, '')) % 24
  const todayDate = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(nowMs))
  const today = dateParts(todayDate).short
  const homeName = homeSlug ? VENUES.find(v => v.slug === homeSlug)?.name : null
  const nextVenue = next?.courts?.venue_slug ? getVenue(next.courts.venue_slug) : null
  const cur = currencyForRegion(nextVenue?.region)
  const chips = shareChips(shares)
  const usualDate = usual ? nextOccurrence(usual, nowMs) : null
  const usualCur = usual ? currencyForRegion(getVenue(usual.venueSlug)?.region) : cur
  // "ends Sunday": the weekday an offer stops, at the club's own clock ("ends today" if that is today).
  const endsOn = (iso: string | null | undefined): string => {
    if (!iso) return ''
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
    return day === todayDate ? 'ends today' : `ends ${new Intl.DateTimeFormat('en-NZ', { timeZone: tz, weekday: 'long' }).format(new Date(iso))}`
  }
  const pill = { background: '#ffffff26', color: '#ffffff', minHeight: 32 } as const

  return (
    <div className="w-full flex flex-col gap-4" data-testid="home">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }} data-testid="greeting">{greetingFor(hour)}{name ? `, ${name}` : ''}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{today}{homeName ? ` · ${homeName}` : ''}</p>
      </div>

      <div className="grid gap-4 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
        {next ? (
          <div>
            <section className="relative text-white" data-testid="next-game" style={{ background: TICKET, borderRadius: 24 }}>
              <div className="flex items-center gap-4 px-5 pt-5 pb-5">
                <CourtTile name={next.courts?.name ?? 'Court'} size={72} />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-extrabold uppercase whitespace-nowrap truncate" style={{ letterSpacing: '0.12em', color: SOFT }}>Next game · {dateParts(next.date).short}</div>
                  <h2 className="font-black leading-none" style={{ fontSize: 38, letterSpacing: '-0.03em', color: '#ffffff' }}>{fmtClock(next.start_time)}</h2>
                  <div className="text-[14px] font-bold mt-1.5" style={{ color: SOFT }}>until {fmtUntil(next.start_time, next.end_time ?? next.start_time)}{next.duration_minutes ? ` · ${next.duration_minutes} min` : ''}</div>
                </div>
              </div>
              <div className="relative" style={{ height: 0 }} aria-hidden>
                <div style={{ position: 'absolute', left: 20, right: 20, top: -1, borderTop: '2px dashed #ffffff55' }} />
                <span style={{ position: 'absolute', left: -13, top: -13, width: 26, height: 26, borderRadius: 13, background: 'var(--bg-base)' }} />
                <span style={{ position: 'absolute', right: -13, top: -13, width: 26, height: 26, borderRadius: 13, background: 'var(--bg-base)' }} />
              </div>
              <div className="flex flex-wrap items-center gap-2 px-5 pt-4 pb-5" data-testid="next-game-actions">
                <Link href="/mybookings" aria-label="Invite a friend"><Avatars names={[fullName ?? name ?? 'You', ...shares.paid, ...shares.waiting]} plus size={28} /></Link>
                <span className="text-[11px] font-black rounded-full px-2.5 py-1 whitespace-nowrap" data-testid="countdown" style={{ background: BALL, color: INK }}>{countdownLabel(next, nowMs)}</span>
                {nextVenue && <a href={mapsUrl(nextVenue.address)} target="_blank" rel="noopener noreferrer" data-testid="directions"
                  className="rounded-full px-3 text-[11.5px] font-extrabold inline-flex items-center justify-center whitespace-nowrap" style={pill}>Directions</a>}
                <Link href="/mybookings" aria-label="Edit booking" className="rounded-full px-3 text-[11.5px] font-extrabold inline-flex items-center justify-center whitespace-nowrap" style={pill}>Edit</Link>
              </div>
            </section>
            <div className="flex items-center justify-between gap-3 px-1.5 pt-2.5">
              <span className="text-[13px] min-w-0 truncate" style={{ color: 'var(--text-muted)' }}>{nextVenue?.name ?? ''}<span className="sr-only">{next.courts?.name ? ` · ${next.courts.name}` : ''}</span></span>
              <a href={buildBookingIcsDataUri({
                uid: next.id, title: `Padel at ${nextVenue?.name ?? 'PadelClub'}`, description: `${next.courts?.name ?? 'Court'} · booked with PadelClub`,
                location: nextVenue ? `${nextVenue.name}, ${nextVenue.address}` : '', date: next.date, startTime: next.start_time, endTime: next.end_time ?? next.start_time,
              })} download={`padel-${next.date}.ics`} data-testid="add-to-calendar" aria-label="Add to calendar" className="text-[13px] font-extrabold shrink-0" style={{ color: 'var(--brand-primary-text)' }}>Add to calendar</a>
            </div>
            {chips.length > 0 && (
              <div className="flex flex-wrap gap-1.5 px-1.5 pt-2" data-testid="share-chips">
                {chips.map(c => (
                  <span key={c.text} className="text-[11px] font-extrabold rounded-full px-2.5 py-1"
                    style={c.paid ? { background: 'var(--brand-green-muted)', color: 'var(--brand-green)' } : { background: BALL, color: INK }}>{c.text}</span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <section className="rounded-[22px] p-5 sm:p-6" data-testid="no-game" style={card}>
            <h2 className="text-lg font-extrabold" style={{ color: 'var(--text-primary)' }}>No game booked yet</h2>
            <p className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>Pick a club, a day and a time, and your next game shows up here.</p>
          </section>
        )}

        <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-4 lg:grid-cols-[minmax(0,1fr)]">
          <Link href="/book" data-testid="book-court" className="rounded-[20px] p-4 flex flex-col justify-between gap-3 min-h-[104px]" style={{ background: 'var(--brand-primary)', color: 'var(--brand-primary-on)', boxShadow: 'var(--glow-primary)' }}>
            <span className="text-[11px] font-extrabold uppercase" style={{ letterSpacing: '0.1em', opacity: 0.85 }}>Book a court</span>
            <span className="text-[17px] font-black leading-tight">Pick a time in a minute</span>
            <span className="text-lg font-extrabold leading-none" aria-hidden>→</span>
          </Link>
          {usual && usualDate ? (
            <Link href={usualLink(usual, usualDate)} data-testid="usual-card" className="rounded-[20px] p-4 flex flex-col justify-between gap-3 min-h-[104px]" style={{ background: BALL, color: INK }}>
              <span className="text-[11px] font-extrabold uppercase" style={{ letterSpacing: '0.1em', opacity: 0.8 }}>Play your usual</span>
              <span className="text-[17px] font-black leading-tight">{usual.weekdayName.slice(0, 3)} {fmtClock(usual.startTime)}, {usual.courtName}</span>
              <span className="text-[12px] font-bold">{formatPrice(usual.price, usualCur)} · tap to rebook</span>
              <span className="sr-only">{venueName(usual.venueSlug)}. Pick the time on {dateParts(usualDate).short}.</span>
            </Link>
          ) : (
            <Link href="/find-a-game" className="rounded-[20px] p-4 flex flex-col justify-between gap-3 min-h-[104px]" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <span className="text-[11px] font-extrabold uppercase" style={{ letterSpacing: '0.1em', color: 'var(--text-subtle)' }}>Open play</span>
              <span className="text-[17px] font-black leading-tight">Join a game near your level</span>
              <span className="text-lg font-extrabold leading-none" aria-hidden>→</span>
            </Link>
          )}
        </div>
      </div>

      {games.length > 0 && (
        <section data-testid="open-games">
          <div className="flex items-baseline justify-between mb-2.5 px-0.5">
            <h3 className="text-[11px] font-extrabold uppercase" style={label}>Games you can join</h3>
            <Link href="/find-a-game" className="text-xs font-bold" style={{ color: 'var(--brand-primary-text)' }}>See all →</Link>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {games.map(g => {
              const left = g.spotsTotal - g.filled
              const word = dayWord(g.date, todayDate, g.start_time)
              const where = [g.court, g.venue_slug !== homeSlug ? venueName(g.venue_slug) : null].filter(Boolean).join(' · ')
              return (
                <Link key={g.id} href="/find-a-game" className="rounded-[20px] p-4 flex items-center gap-3.5" style={card}>
                  <span className="shrink-0 flex flex-col items-center justify-center rounded-[15px]" style={{ width: 52, height: 52, background: 'var(--brand-primary-muted)', color: 'var(--brand-primary-text)' }} aria-hidden>
                    <span className="text-[8px] font-black" style={{ letterSpacing: '0.12em' }}>LEVEL</span>
                    <span className="text-[13px] font-black leading-none mt-0.5">{levelText(g.skill_min, g.skill_max)}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-extrabold" style={{ color: 'var(--text-primary)' }}>{word}{/^(Tonight|Today|Tomorrow)$/.test(word) ? ' ' : ' · '}{fmtClock(g.start_time)}</span>
                    <span className="block text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {where || 'Open game'}
                      {left === 1 && <span className="ml-1.5 text-[10px] font-black rounded-full px-1.5 py-0.5 whitespace-nowrap" style={{ background: BALL, color: INK }}>1 spot left</span>}
                    </span>
                    <span className="flex items-center gap-1.5 mt-2" aria-label={`${g.filled} of ${g.spotsTotal} in`}>
                      {Array.from({ length: g.spotsTotal }, (_, i) => <i key={i} style={{ width: 16, height: 16, borderRadius: 8, display: 'block', background: i < g.filled ? 'var(--brand-primary)' : 'transparent', border: i < g.filled ? 'none' : '1.5px dashed var(--text-subtle)' }} />)}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full px-3.5 py-2 text-[12px] font-black" style={{ background: 'var(--brand-primary-muted)', color: 'var(--brand-primary-text)' }} aria-hidden>Join</span>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {(offer || saved > 0) && (
        <section data-testid="for-you">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {offer && (
              <Link href="/book?offer=1" data-testid="offer-card" className="rounded-[20px] px-4 py-3.5 flex items-center justify-between gap-3 text-white" style={{ background: 'linear-gradient(160deg, #1f9a5f, #0f5c38)' }}>
                <span className="min-w-0">
                  <span className="block text-[10.5px] font-extrabold uppercase" style={{ letterSpacing: '0.1em', opacity: 0.85 }}>Offer from your club</span>
                  <span className="block text-[19px] font-black leading-tight mt-1">{offer.discount_percent}% off {dateParts(offer.date).weekday} {fmtHour(offer.start_time)}</span>
                  <span className="block text-xs mt-1" style={{ opacity: 0.9 }}>Quiet time{offer.venue_slug !== homeSlug ? ` · ${venueName(offer.venue_slug)}` : ''}{endsOn(offer.closes_at) ? ` · ${endsOn(offer.closes_at)}` : ''}</span>
                </span>
                <span className="shrink-0 rounded-full px-3.5 py-2 text-[12px] font-black" style={{ background: '#ffffff', color: '#0f5c38' }} aria-hidden>Grab it</span>
              </Link>
            )}
            {saved > 0 && (
              <Link href="/membership" data-testid="saved-card" className="rounded-[20px] px-4 py-3.5 text-white" style={{ background: TICKET }}>
                <span className="block text-[10.5px] font-extrabold uppercase" style={{ letterSpacing: '0.1em', color: SOFT }}>Your membership</span>
                <span className="block text-[18px] font-black leading-tight mt-1">You&apos;ve saved {formatPrice(saved, cur)} in the last 30 days</span>
                <span className="block text-xs mt-1" style={{ color: SOFT }}>Your plan discount on court bookings</span>
              </Link>
            )}
          </div>
        </section>
      )}

      {month && (
        <section data-testid="your-month">
          <h3 className="text-[11px] font-extrabold uppercase mb-2.5 px-0.5" style={label}>Your month</h3>
          <div className="grid grid-cols-3 gap-4">
            {[
              { n: month.games, t: month.games === 1 ? 'game played' : 'games played' },
              { n: month.people, t: month.people === 1 ? 'person you’ve played with' : 'people you’ve played with' },
              { n: month.weeks, t: month.weeks === 1 ? 'week in a row' : 'weeks in a row' },
            ].map(x => (
              <div key={x.t} className="rounded-[20px] p-4" style={card}>
                <b className="block text-[28px] font-black leading-none" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{x.n}</b>
                <span className="block text-[11px] mt-1.5 leading-snug" style={{ color: 'var(--text-muted)' }}>{x.t}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
