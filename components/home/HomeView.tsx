import Link from 'next/link'
import { VENUES, getVenue } from '@/lib/venues'
import { currencyForRegion, formatPrice } from '@/lib/currency'
import { buildBookingIcsDataUri } from '@/lib/ics'
import { fmtClock, fmtHour, fmtUntil } from '@/lib/clock'
import { countdownLabel, dayWord, greetingFor, inDays, weekStrip, levelText, mapsUrl, nextOccurrence, shareChips, startsAtMs, usualLink, type HomeBooking, type Usual } from '@/lib/home-rules'
import { Avatars, CourtTile } from '@/components/booking/BookingTicket'
import GameCountdown from '@/components/home/GameCountdown'
import NextGameCourt from '@/components/home/NextGameCourt'

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

// Phones show the ticket, two tiles and cards. From tablet width up Home becomes the scoreboard: a flip clock counting down to the
// next game beside a court that shows who is in, then fixtures to join, what is coming up, and the numbers.
export default function HomeView({ name, fullName, homeSlug, tz, nowMs, next, shares, usual, games, offer, saved, month, later, notices = [] }: {
  name: string | null; fullName?: string | null; homeSlug: string | null; tz: string; nowMs: number
  next: (HomeBooking & { id: string }) | null
  shares: { paid: string[]; waiting: string[] }
  usual: Usual | null; games: Game[]; offer: Offer | null; saved: number
  // The "Your month" numbers; null when there is nothing to show yet (a brand-new player).
  month: { games: number; people: number; weeks: number } | null
  // The bookings after the next game (desktop "Coming up").
  later: (HomeBooking & { id: string })[]
  // Messages from the player's club (an owner's announcement), still within their week on Home.
  notices?: { id: string; club: string; title: string; body: string; age: string }[]
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
  const seatNames = [fullName ?? name ?? 'You', ...shares.paid, ...shares.waiting].slice(0, 4)
  const seatsOpen = 4 - seatNames.length
  const calendarHref = next ? buildBookingIcsDataUri({
    uid: next.id, title: `Padel at ${nextVenue?.name ?? 'PadelMate'}`, description: `${next.courts?.name ?? 'Court'} · booked with PadelMate`,
    location: nextVenue ? `${nextVenue.name}, ${nextVenue.address}` : '', date: next.date, startTime: next.start_time, endTime: next.end_time ?? next.start_time,
  }) : ''

  return (
    <div className="w-full flex flex-col gap-4" data-testid="home">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }} data-testid="greeting">{greetingFor(hour)}{name ? `, ${name}` : ''}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{today}{homeName ? ` · ${homeName}` : ''}</p>
        </div>
        <div className="hidden md:flex items-center gap-2.5 shrink-0">
          <Link href="/book" data-testid="book-court" className="rounded-full px-5 text-[14px] font-black uppercase inline-flex items-center" style={{ minHeight: 44, letterSpacing: '0.04em', background: 'var(--brand-primary)', color: 'var(--brand-primary-on)', boxShadow: 'var(--glow-primary)' }}>Book a court →</Link>
          <Link href="/find-a-game" data-testid="open-play-link" className="rounded-full px-5 text-[14px] font-black uppercase inline-flex items-center" style={{ minHeight: 44, letterSpacing: '0.04em', background: 'transparent', border: '2px solid var(--brand-primary)', color: 'var(--brand-primary-text)' }}>Open play →</Link>
        </div>
      </div>

      {notices.map(n => (
        <div key={n.id} data-testid="club-notice" className="rounded-[20px] p-4" style={{ border: '1px solid var(--brand-primary)', background: 'linear-gradient(160deg, var(--brand-primary-muted), var(--bg-surface))' }}>
          <div className="text-[11px] font-extrabold uppercase" style={{ letterSpacing: '0.12em', color: 'var(--brand-primary-text)' }}>From {n.club} · {n.age}</div>
          <div className="text-[17px] font-extrabold mt-1.5" style={{ color: 'var(--text-primary)' }}>{n.title}</div>
          {n.body && <div className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{n.body}</div>}
        </div>
      ))}

      {next ? (
        <>
          {/* Phones: the ticket, then the Book a court and usual tiles */}
          <div className="md:hidden flex flex-col gap-4">
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
                  <Link href="/mybookings" aria-label="Invite a friend"><Avatars names={seatNames} plus size={28} /></Link>
                  <span className="text-[11px] font-black rounded-full px-2.5 py-1 whitespace-nowrap" data-testid="countdown" style={{ background: BALL, color: INK }}>{countdownLabel(next, nowMs)}</span>
                  {nextVenue && <a href={mapsUrl(nextVenue.address)} target="_blank" rel="noopener noreferrer" data-testid="directions"
                    className="rounded-full px-3 text-[11.5px] font-extrabold inline-flex items-center justify-center whitespace-nowrap" style={pill}>Directions</a>}
                  <Link href="/mybookings" aria-label="Edit booking" className="rounded-full px-3 text-[11.5px] font-extrabold inline-flex items-center justify-center whitespace-nowrap" style={pill}>Edit</Link>
                </div>
              </section>
              <div className="flex items-center justify-between gap-3 px-1.5 pt-2.5">
                <span className="text-[13px] min-w-0 truncate" style={{ color: 'var(--text-muted)' }}>{nextVenue?.name ?? ''}<span className="sr-only">{next.courts?.name ? ` · ${next.courts.name}` : ''}</span></span>
                <a href={calendarHref} download={`padel-${next.date}.ics`} data-testid="add-to-calendar" aria-label="Add to calendar" className="text-[13px] font-extrabold shrink-0" style={{ color: 'var(--brand-primary-text)' }}>Add to calendar</a>
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
            <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-4">
              <Link href="/book" data-testid="book-court" className="rounded-[20px] p-4 flex flex-col justify-between gap-3 min-h-[104px]" style={{ background: 'var(--brand-primary)', color: 'var(--brand-primary-on)', boxShadow: 'var(--glow-primary)' }}>
                <span className="text-[11px] font-extrabold uppercase" style={{ letterSpacing: '0.1em', opacity: 0.85 }}>Book a court</span>
                <span className="text-[17px] font-black leading-tight">Book in seconds</span>
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

          {/* Tablet and desktop: the scoreboard */}
          <section className="hidden md:block relative overflow-hidden text-white" data-testid="next-game-desktop"
            style={{ borderRadius: 20, background: 'radial-gradient(120% 160% at 50% 0%, #1d3f8d 0%, #12234f 55%, #0c1736 100%)', border: '1px solid #ffffff1c' }}>
            <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ background: 'repeating-linear-gradient(90deg, #ffffff06 0 2px, transparent 2px 28px)' }} />
            <div className="relative flex flex-wrap items-center gap-6 p-6 xl:px-7">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 mb-4 w-0 min-w-full" data-testid="kickoff-row">
                  <span className="text-[14px] font-extrabold uppercase" style={{ letterSpacing: '0.1em', color: SOFT }}>Kick-off in · {dateParts(next.date).short} · {next.courts?.name ?? 'Court'}</span>
                  <span className="text-[14px] font-black rounded-full px-3.5 py-1.5 whitespace-nowrap" style={{ background: BALL, color: INK }}>{fmtClock(next.start_time)} – {fmtUntil(next.start_time, next.end_time ?? next.start_time)}{next.duration_minutes ? ` · ${next.duration_minutes} min` : ''}</span>
                </div>
                <GameCountdown startMs={startsAtMs(next)} nowMs={nowMs} />
                <div className="flex flex-wrap gap-2 mt-4">
                  {nextVenue && <a href={mapsUrl(nextVenue.address)} target="_blank" rel="noopener noreferrer" data-testid="directions-desktop" className="rounded-full px-4 text-[12px] font-extrabold inline-flex items-center" style={{ ...pill, minHeight: 38 }}>Directions</a>}
                  <Link href="/mybookings" aria-label="Edit booking" className="rounded-full px-4 text-[12px] font-extrabold inline-flex items-center" style={{ ...pill, minHeight: 38 }}>Edit</Link>
                  <a href={calendarHref} download={`padel-${next.date}.ics`} data-testid="add-to-calendar-desktop" className="rounded-full px-4 text-[12px] font-extrabold inline-flex items-center" style={{ ...pill, minHeight: 38 }}>Add to calendar</a>
                </div>
              </div>
              <div className="flex-1 min-w-[300px]">
                <div className="mx-auto" style={{ maxWidth: 430 }}><NextGameCourt courtName={next.courts?.name ?? 'Court'} names={seatNames} inviteHref="/mybookings" /></div>
                <p className="text-center text-[12px] mt-1" style={{ color: SOFT }} data-testid="seats-line">
                  {seatsOpen > 0 ? `${seatsOpen === 1 ? 'One seat is' : `${seatsOpen === 2 ? 'Two' : 'Three'} seats are`} open · tap a dashed seat to invite a mate` : 'Full house · everyone is in'}
                </p>
                {chips.length > 0 && <p className="text-center text-[12px] mt-1 font-bold" style={{ color: SOFT }} data-testid="share-chips-desktop">{chips.map(c => c.text).join(' · ')}</p>}
              </div>
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="rounded-[22px] p-5 sm:p-6" data-testid="no-game" style={card}>
            <h2 className="text-lg font-extrabold" style={{ color: 'var(--text-primary)' }}>No game booked yet</h2>
            <p className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>Pick a club, a day and a time, and your next game shows up here.</p>
          </section>
          <div className="md:hidden grid grid-cols-[repeat(2,minmax(0,1fr))] gap-4">
            <Link href="/book" data-testid="book-court" className="rounded-[20px] p-4 flex flex-col justify-between gap-3 min-h-[104px]" style={{ background: 'var(--brand-primary)', color: 'var(--brand-primary-on)', boxShadow: 'var(--glow-primary)' }}>
              <span className="text-[11px] font-extrabold uppercase" style={{ letterSpacing: '0.1em', opacity: 0.85 }}>Book a court</span>
              <span className="text-[17px] font-black leading-tight">Book in seconds</span>
              <span className="text-lg font-extrabold leading-none" aria-hidden>→</span>
            </Link>
            <Link href="/find-a-game" className="rounded-[20px] p-4 flex flex-col justify-between gap-3 min-h-[104px]" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <span className="text-[11px] font-extrabold uppercase" style={{ letterSpacing: '0.1em', color: 'var(--text-subtle)' }}>Open play</span>
              <span className="text-[17px] font-black leading-tight">Join a game near your level</span>
              <span className="text-lg font-extrabold leading-none" aria-hidden>→</span>
            </Link>
          </div>
        </>
      )}

      <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
        <div className="flex flex-col gap-4 min-w-0">
          {games.length > 0 && (
            <section data-testid="open-games">
              <div className="flex items-baseline justify-between mb-2.5 px-0.5">
                <h3 className="text-[11px] font-extrabold uppercase" style={label}>Games you can join</h3>
                <Link href="/find-a-game" className="text-xs font-bold" style={{ color: 'var(--brand-primary-text)' }}>See all →</Link>
              </div>
              <div className="md:hidden grid grid-cols-1 gap-4">
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
              <div className="hidden md:block rounded-[20px] overflow-hidden" style={card} data-testid="fixtures">
                {games.map((g, i) => {
                  const left = g.spotsTotal - g.filled
                  const word = dayWord(g.date, todayDate, g.start_time)
                  const where = [g.court, g.venue_slug !== homeSlug ? venueName(g.venue_slug) : null].filter(Boolean).join(' · ')
                  return (
                    <Link key={g.id} href="/find-a-game" className="flex items-center gap-4 px-4 py-3.5" style={{ borderTop: i ? '1px solid var(--border)' : 'none' }}>
                      <span className="shrink-0 w-[150px] text-[13.5px] font-black whitespace-nowrap" style={{ color: 'var(--brand-primary-text)', fontFamily: "'Courier New', ui-monospace, monospace" }}>
                        {word.toUpperCase()}{/^(Tonight|Today|Tomorrow)$/.test(word) ? ' ' : ' · '}{fmtClock(g.start_time)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[14.5px] font-extrabold" style={{ color: 'var(--text-primary)' }}>
                        {where || 'Open game'} <span className="font-semibold" style={{ color: 'var(--text-subtle)' }}>· Level {levelText(g.skill_min, g.skill_max)}</span>
                      </span>
                      <span className="flex items-center gap-1" aria-label={`${g.filled} of ${g.spotsTotal} in`}>
                        {Array.from({ length: g.spotsTotal }, (_, k) => <i key={k} style={{ width: 12, height: 12, borderRadius: 6, display: 'block', background: k < g.filled ? 'var(--brand-primary)' : 'transparent', border: k < g.filled ? 'none' : '1.5px dashed var(--text-subtle)' }} />)}
                      </span>
                      <span className="shrink-0 w-[84px] text-right">{left === 1 && <span className="text-[10px] font-black rounded-full px-2 py-0.5 whitespace-nowrap" style={{ background: BALL, color: INK }}>1 spot left</span>}</span>
                      <span className="shrink-0 rounded-full px-4 py-1.5 text-[12px] font-black" style={{ background: 'var(--brand-primary-muted)', color: 'var(--brand-primary-text)' }} aria-hidden>Join</span>
                    </Link>
                  )
                })}
              </div>
            </section>
          )}

          {later.length > 0 && (
            <section className="hidden md:block" data-testid="coming-up">
              <h3 className="text-[11px] font-extrabold uppercase mb-2.5 px-0.5" style={label}>Coming up</h3>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] items-stretch">
                <div className="rounded-[20px] overflow-hidden" style={card}>
                  {later.map((b, i) => {
                    const v = b.courts?.venue_slug ? getVenue(b.courts.venue_slug) : null
                    const owes = !b.stripe_payment_id && !!b.pay_by
                    return (
                      <Link key={b.id} href="/mybookings" className="flex items-center gap-4 px-4 py-3.5" style={{ borderTop: i ? '1px solid var(--border)' : 'none' }}>
                        <span className="shrink-0 w-[112px]"><span data-testid="coming-up-date" className="inline-block rounded-full px-3.5 py-1 text-[14px] font-extrabold whitespace-nowrap" style={{ background: 'var(--brand-primary)', color: 'var(--brand-primary-on)' }}>{dateParts(b.date).short}</span></span>
                        <span className="min-w-0 flex-1 truncate text-[14.5px] font-extrabold" style={{ color: 'var(--text-primary)' }}>
                          {b.courts?.name ?? 'Court'} <span className="font-semibold" style={{ color: 'var(--text-subtle)' }}>· {b.regular_id ? 'Every week · ' : ''}{fmtClock(b.start_time)}{v && v.slug !== homeSlug ? ` · ${v.name}` : ''}</span>
                        </span>
                        {owes && <span className="shrink-0 text-[11px] font-black rounded-full px-2.5 py-1 whitespace-nowrap" style={{ background: BALL, color: INK }}>Pay your share</span>}
                        <span className="shrink-0 text-[12px] whitespace-nowrap" style={{ color: 'var(--text-muted)' }} data-testid="coming-up-in">{inDays(b.date, todayDate)}</span>
                      </Link>
                    )
                  })}
                </div>
                <div className="rounded-[20px] p-5 flex flex-col" style={card} data-testid="week-panel">
                  <h4 className="text-[11px] font-extrabold uppercase mb-3" style={label}>This week</h4>
                  <div className="grid grid-cols-7 gap-1">
                    {weekStrip(todayDate, [next?.date, ...later.map(b => b.date)].filter((d): d is string => !!d)).map(d => (
                      <div key={d.date} data-testid="week-day" data-booked={d.booked ? 'yes' : 'no'} className="text-center rounded-xl py-2" style={{ background: d.isToday ? 'var(--bg-raised)' : 'transparent' }}>
                        <div className="text-[10.5px] font-extrabold" style={{ color: 'var(--text-muted)' }}>{d.weekday}</div>
                        <div className="text-[15px] font-extrabold mt-0.5 mb-1.5" style={{ color: 'var(--text-primary)' }}>{d.day}</div>
                        <i className="block mx-auto rounded-full" style={{ width: 8, height: 8, background: d.booked ? BALL : 'transparent', border: d.booked ? 'none' : '1px solid var(--border)' }} />
                      </div>
                    ))}
                  </div>
                  <div className="mt-auto pt-4 flex items-center justify-between gap-3" style={{ borderTop: '1px solid var(--border)' }}>
                    {(() => {
                      const n = weekStrip(todayDate, [next?.date, ...later.map(b => b.date)].filter((d): d is string => !!d)).filter(d => d.booked).length
                      return <span className="text-[12.5px]" style={{ color: 'var(--text-muted)' }} data-testid="week-count"><b style={{ color: 'var(--text-primary)' }}>{n} {n === 1 ? 'day' : 'days'}</b> with a game this week</span>
                    })()}
                    <Link href="/book" className="shrink-0 rounded-full px-3.5 py-2 text-[12px] font-black" style={{ background: BALL, color: INK }}>Book another</Link>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>

        <div className="flex flex-col gap-4 min-w-0">
          {month && (
            <section data-testid="your-month" className="order-2 xl:order-1">
              <h3 className="text-[11px] font-extrabold uppercase mb-2.5 px-0.5 xl:hidden" style={label}>Your month</h3>
              <div className="grid grid-cols-3 gap-4 xl:hidden">
                {[
                  { n: month.games, t: month.games === 1 ? 'game played' : 'games played' },
                  { n: month.people, t: month.people === 1 ? 'person you\u2019ve played with' : 'people you\u2019ve played with' },
                  { n: month.weeks, t: month.weeks === 1 ? 'week in a row' : 'weeks in a row' },
                ].map(x => (
                  <div key={x.t} className="rounded-[20px] p-4" style={card}>
                    <b className="block text-[28px] font-black leading-none" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{x.n}</b>
                    <span className="block text-[11px] mt-1.5 leading-snug" style={{ color: 'var(--text-muted)' }}>{x.t}</span>
                  </div>
                ))}
              </div>
              <div className="hidden xl:flex gap-2.5" data-testid="score-digits">
                {[
                  { n: month.games, t: 'Games this month' },
                  { n: month.people, t: 'Players met' },
                  { n: month.weeks, t: 'Week streak' },
                ].map(x => (
                  <div key={x.t} className="flex-1 text-center rounded-[14px] px-1.5 pt-3 pb-2.5" style={{ background: '#0f1318', border: '1px solid #ffffff12' }}>
                    <b className="block font-black leading-none text-[38px]" style={{ color: BALL, textShadow: '0 0 16px #d4f53c88', fontFamily: "'Courier New', ui-monospace, monospace" }}>{x.n}</b>
                    <span className="block mt-2 text-[9.5px] font-extrabold uppercase leading-tight" style={{ letterSpacing: '0.12em', color: '#9fb0c0' }}>{x.t}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
          {(offer || saved > 0) && (
            <section data-testid="for-you" className="order-1 xl:order-2">
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-1 gap-4">
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
        </div>
      </div>
    </div>
  )
}
