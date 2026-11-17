import Link from 'next/link'
import { VENUES, getVenue } from '@/lib/venues'
import { currencyForRegion, formatPrice } from '@/lib/currency'
import { buildBookingIcsDataUri } from '@/lib/ics'
import { greetingFor, mapsUrl, nextOccurrence, shareChips, usualLink, type HomeBooking, type Usual } from '@/lib/home-rules'

const card = { background: 'var(--bg-surface)', border: '1px solid var(--border)' } as const
const label = { letterSpacing: '0.14em', color: 'var(--text-subtle)' } as const
const hhmm = (t: string) => String(t).slice(0, 5)
const dateParts = (date: string) => {
  const d = new Date(date + 'T12:00:00Z')
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-NZ', { timeZone: 'UTC', ...o }).format(d)
  return { weekday: f({ weekday: 'short' }).toUpperCase(), day: f({ day: 'numeric' }), month: f({ month: 'short' }), long: f({ weekday: 'long', day: 'numeric', month: 'long' }), short: f({ weekday: 'short', day: 'numeric', month: 'short' }) }
}
const venueName = (slug: string) => VENUES.find(v => v.slug === slug)?.name ?? slug

type Game = { id: string; date: string; start_time: string; venue_slug: string; skill_min: number; skill_max: number; spotsTotal: number; filled: number; ratings: number[] }
type Offer = { venue_slug: string; date: string; start_time: string; end_time: string; discount_percent: number }

export default function HomeView({ name, homeSlug, tz, nowMs, next, shares, usual, games, offer, saved }: {
  name: string | null; homeSlug: string | null; tz: string; nowMs: number
  next: (HomeBooking & { id: string }) | null
  shares: { paid: string[]; waiting: string[] }
  usual: Usual | null; games: Game[]; offer: Offer | null; saved: number
}) {
  const hour = Number(new Intl.DateTimeFormat('en-NZ', { timeZone: tz, hour: 'numeric', hour12: false }).format(new Date(nowMs)).replace(/\D/g, '')) % 24
  const today = new Intl.DateTimeFormat('en-NZ', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(nowMs))
  const homeName = homeSlug ? VENUES.find(v => v.slug === homeSlug)?.name : null
  const nextVenue = next?.courts?.venue_slug ? getVenue(next.courts.venue_slug) : null
  const cur = currencyForRegion(nextVenue?.region)
  const chips = shareChips(shares)
  const usualDate = usual ? nextOccurrence(usual, nowMs) : null
  const usualCur = usual ? currencyForRegion(getVenue(usual.venueSlug)?.region) : cur

  return (
    <div className="w-full flex flex-col gap-4" data-testid="home">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }} data-testid="greeting">{greetingFor(hour)}{name ? `, ${name}` : ''}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{today}{homeName ? ` · ${homeName} is your home club` : ''}</p>
      </div>

      {next ? (
        <section className="rounded-2xl p-5 sm:p-6" data-testid="next-game" style={{ background: 'linear-gradient(135deg, var(--brand-primary-muted), var(--bg-surface))', border: '1px solid var(--brand-primary)' }}>
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="rounded-[18px] shrink-0 flex flex-col items-center justify-center text-center" style={{ width: 72, height: 80, background: 'var(--brand-primary)', color: 'var(--brand-primary-on)' }}>
              <span className="text-[11px] font-extrabold" style={{ letterSpacing: '0.12em', opacity: 0.85 }}>{dateParts(next.date).weekday}</span>
              <span className="text-[30px] font-extrabold leading-none">{dateParts(next.date).day}</span>
              <span className="text-[11px]" style={{ opacity: 0.85 }}>{dateParts(next.date).month}</span>
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-extrabold" style={{ color: 'var(--text-primary)' }}>Your next game · {hhmm(next.start_time)}</h2>
              <p className="text-[13px] mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {next.courts?.name ?? 'Court'} · {nextVenue?.name ?? ''}{next.duration_minutes ? ` · ${next.duration_minutes} min` : ''}
              </p>
              {chips.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5" data-testid="share-chips">
                  {chips.map(c => (
                    <span key={c.text} className="text-[11px] font-extrabold rounded-full px-2.5 py-1"
                      style={c.paid ? { background: 'var(--brand-green-muted)', color: 'var(--brand-green)' } : { background: 'var(--brand-yellow-muted)', color: 'var(--brand-yellow)' }}>{c.text}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="grid gap-2.5 mt-4" data-testid="next-game-actions" style={{ gridTemplateColumns: `repeat(${nextVenue ? 3 : 2}, minmax(0, 1fr))` }}>
            <a href={buildBookingIcsDataUri({
              uid: next.id, title: `Padel at ${nextVenue?.name ?? 'PadelClub'}`, description: `${next.courts?.name ?? 'Court'} · booked with PadelClub`,
              location: nextVenue ? `${nextVenue.name}, ${nextVenue.address}` : '', date: next.date, startTime: next.start_time, endTime: next.end_time ?? next.start_time,
            })} download={`padel-${next.date}.ics`} data-testid="add-to-calendar"
              className="rounded-xl px-1 text-[13px] font-extrabold flex items-center justify-center text-center whitespace-nowrap" style={{ minHeight: 44, background: 'var(--text-primary)', color: 'var(--bg-base)' }} aria-label="Add to calendar"><span className="hidden min-[400px]:inline">Add to calendar</span><span className="min-[400px]:hidden">Calendar</span></a>
            {nextVenue && <a href={mapsUrl(nextVenue.address)} target="_blank" rel="noopener noreferrer" data-testid="directions"
              className="rounded-xl px-1 text-[13px] font-extrabold flex items-center justify-center text-center whitespace-nowrap" style={{ minHeight: 44, background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>Directions</a>}
            <Link href="/mybookings" className="rounded-xl px-1 text-[13px] font-extrabold flex items-center justify-center text-center whitespace-nowrap" style={{ minHeight: 44, background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>Edit booking</Link>
          </div>
        </section>
      ) : (
        <section className="rounded-[22px] p-5 sm:p-6" data-testid="no-game" style={card}>
          <h2 className="text-lg font-extrabold" style={{ color: 'var(--text-primary)' }}>No game booked yet</h2>
          <p className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>Pick a club, a day and a time, and your next game shows up here.</p>
        </section>
      )}

      {usual && usualDate && (
        <Link href={usualLink(usual, usualDate)} data-testid="usual-card" className="flex items-center gap-4 rounded-[20px] px-5 py-4" style={card}>
          <span className="flex items-center justify-center rounded-[14px] shrink-0 text-lg" style={{ width: 42, height: 42, background: 'var(--brand-primary-muted)' }} aria-hidden>⭐</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-extrabold" style={{ color: 'var(--text-primary)' }}>Book your usual</span>
            <span className="block text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{usual.weekdayName} {usual.startTime} · {usual.courtName} · {venueName(usual.venueSlug)} · {formatPrice(usual.price, usualCur)}. Pick the time on {dateParts(usualDate).short}.</span>
          </span>
          <span className="rounded-xl px-4 text-[13px] font-extrabold inline-flex items-center shrink-0" style={{ minHeight: 40, background: 'var(--brand-primary)', color: 'var(--brand-primary-on)' }}>Book again →</span>
        </Link>
      )}

      <Link href="/book" data-testid="book-court" className="flex items-center gap-3 rounded-[20px] px-6 py-5" style={{ background: 'var(--brand-primary)', color: 'var(--brand-primary-on)', boxShadow: 'var(--glow-primary)' }}>
        <span>
          <span className="block text-lg font-extrabold">Book a court</span>
          <span className="block text-[12.5px] mt-0.5" style={{ opacity: 0.85 }}>Pick a club, a day and a time in under a minute</span>
        </span>
        <span className="ml-auto text-2xl font-extrabold" aria-hidden>→</span>
      </Link>

      {games.length > 0 && (
        <section data-testid="open-games">
          <div className="flex items-baseline justify-between mb-2.5 px-0.5">
            <h3 className="text-[11px] font-extrabold uppercase" style={label}>Games you can join, near your level</h3>
            <Link href="/find-a-game" className="text-xs font-bold" style={{ color: 'var(--brand-primary-text)' }}>See all open play →</Link>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {games.map(g => (
              <Link key={g.id} href="/find-a-game" className="rounded-[20px] p-4" style={card}>
                <span className="block text-[15px] font-extrabold" style={{ color: 'var(--text-primary)' }}>{dateParts(g.date).short} · {hhmm(g.start_time)}</span>
                <span className="block text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{venueName(g.venue_slug)} · Level {g.skill_min.toFixed(1)}–{g.skill_max.toFixed(1)} · {g.filled} of {g.spotsTotal} in</span>
                <span className="flex items-center gap-1.5 mt-3" aria-hidden>
                  {Array.from({ length: g.spotsTotal }, (_, i) => <i key={i} style={{ width: 20, height: 20, borderRadius: 10, display: 'block', background: i < g.filled ? 'var(--brand-primary)' : 'transparent', border: i < g.filled ? 'none' : '1.5px dashed var(--border)' }} />)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {(offer || saved > 0) && (
        <section data-testid="for-you">
          <h3 className="text-[11px] font-extrabold uppercase mb-2.5 px-0.5" style={label}>For you</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {offer && (
              <Link href="/book?offer=1" data-testid="offer-card" className="rounded-[20px] p-4" style={{ background: 'var(--brand-primary-muted)', border: '1px solid var(--brand-primary)' }}>
                <span className="block text-[11px] font-extrabold" style={{ letterSpacing: '0.06em', color: 'var(--brand-yellow)' }}>LAST-MINUTE DEAL</span>
                <span className="block text-[17px] font-extrabold mt-1.5" style={{ color: 'var(--text-primary)' }}>{offer.discount_percent}% off {dateParts(offer.date).short}, {hhmm(offer.start_time)}–{hhmm(offer.end_time)}</span>
                <span className="block text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{venueName(offer.venue_slug)}</span>
              </Link>
            )}
            {saved > 0 && (
              <Link href="/membership" data-testid="saved-card" className="rounded-[20px] p-4" style={{ background: 'var(--brand-primary-muted)', border: '1px solid var(--brand-primary)' }}>
                <span className="block text-[11px] font-extrabold" style={{ letterSpacing: '0.06em', color: 'var(--brand-yellow)' }}>YOUR MEMBERSHIP</span>
                <span className="block text-[17px] font-extrabold mt-1.5" style={{ color: 'var(--text-primary)' }}>You&apos;ve saved {formatPrice(saved, cur)} in the last 30 days</span>
                <span className="block text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Your plan discount on court bookings</span>
              </Link>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
