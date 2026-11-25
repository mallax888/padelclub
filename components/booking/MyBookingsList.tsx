'use client'

import { clockAt, fmtClock, fmtClockRange, fmtUntil } from '@/lib/clock'
import { GO } from '@/lib/accent'
import { moneyVars } from '@/components/ui/MoneyBubble'
import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { cn, formatDate } from '@/lib/utils'
import { weekGroup } from '@/lib/home-rules'
import { hoursUntilBooking, venueInstant, timezoneForVenueSlug } from '@/lib/timezone'
import { currencyForRegion, formatPrice } from '@/lib/currency'
import { MEMBERSHIP_CONFIG } from '@/types/database'
import { bookAhead, tierLabel } from '@/lib/plan-rules'
import { DEFAULT_RULE, cancelOutcome, hoursWord, isFree, policyDetail, policySummary, type CancellationRule } from '@/lib/cancellation-rules'

// Each club's cancellation rule, from the server page. A club that has not changed it keeps the default.
const RulesCtx = createContext<Record<string, CancellationRule>>({})
const useRule = (slug?: string | null): CancellationRule => useContext(RulesCtx)[slug ?? ''] ?? DEFAULT_RULE
import type { Profile } from '@/types/database'
import Link from 'next/link'
import { VENUES } from '@/lib/venues'
import { buildBookingIcsDataUri } from '@/lib/ics'
import RescheduleModal from '@/components/booking/RescheduleModal'
import { weekFor, type VenueSettingsMap } from '@/lib/venue-settings'
import { shareSchedule, shareStage, coverCents, bookerShareCents } from '@/lib/share-rules'
import { canSkipWeek, weekRows, upcomingWeeks, bookedWeekCount, weekdayPlural, seriesDates, type WeekRow } from '@/lib/regulars-rules'
import PushRemindersPrompt from '@/components/ui/PushRemindersPrompt'
import BookedCelebration from '@/components/booking/BookedCelebration'
import InviteShare from '@/components/invites/InviteShare'
import { CourtTile } from '@/components/booking/BookingTicket'
import PastHistory from '@/components/booking/PastHistory'
import { buildPastHistory, type PastOwn, type PastShare } from '@/lib/past-history'

interface BookingWithCourt {
  id: string
  court_id: string
  date: string
  start_time: string
  end_time: string
  status: string
  price_nzd: number
  duration_minutes: number
  payment_method: string
  stripe_payment_id: string | null
  // Set when this booking is one week of a weekly regular; pay_by is when an unpaid held week is released.
  regular_id?: string | null
  pay_by?: string | null
  created_at?: string
  share_deadline_exempt?: boolean
  courts: { name: string; type: string; is_indoor: boolean } | null
}

interface OutgoingSplit {
  id: string
  booking_id: string
  // Null on an invite seat: a share held open for a friend who has no account
  // yet, until they open the link and take it (see 023_invite_seats.sql).
  user_id: string | null
  invite_token?: string | null
  amount_nzd: number
  status: string
  profiles: { nickname: string | null; full_name: string | null } | null
}

interface SplitRequest {
  id: string
  booking_id: string
  amount_nzd: number
  status: string
  bookings: {
    date: string
    start_time: string
    end_time: string
    created_at?: string
    share_deadline_exempt?: boolean
    courts: { name: string; type: string; venue_slug?: string } | null
  } | null
  profiles: { nickname: string | null; full_name: string | null } | null
}

interface JoinedGame {
  id: string
  amount_nzd: number
  bookings: {
    date: string
    start_time: string
    end_time: string
    duration_minutes: number
    courts: { name: string; type: string; venue_slug: string } | null
    booking_splits?: { user_id: string | null; status: string; profiles: { nickname: string | null; full_name: string | null } | null }[]
  } | null
  profiles: { nickname: string | null; full_name: string | null } | null
}

const AVATAR_COLORS = ['var(--brand-blue)', 'var(--brand-accent)', 'var(--brand-primary)', 'var(--brand-yellow)']

function avatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function getInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || '?'
}

const PlayerChip = ({ name, paid }: { name: string; paid: boolean }) => (
  <span className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full text-xs font-medium"
    style={{ background: 'var(--bg-raised)', border: `1px solid ${paid ? 'var(--brand-primary)' : 'var(--border)'}`, color: paid ? 'var(--brand-primary-text)' : 'var(--text-primary)' }}>
    <span className="inline-flex items-center justify-center rounded-full text-[9px] font-bold shrink-0" style={{ width: 18, height: 18, background: avatarColor(name), color: '#fff' }}>
      {getInitial(name)}
    </span>
    {name.split(' ')[0]}{paid ? ' ✓' : ''}
    {!paid && <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--brand-yellow)', flexShrink: 0 }} />}
  </span>
)

// Opens the organiser's own WhatsApp with the reminder already written, and
// sends nothing: they pick the recipient and press send themselves.
//
// Deliberately not the WhatsApp Business API, which would let the server
// message a member directly -- that needs a Meta business account, templates
// approved by Meta, a fee per conversation, and every member's phone number
// held with their consent. A wa.me link needs none of those, because it is
// one person messaging another in the app they already use for exactly this.
//
// No number is put in the link even where we hold one: WhatsApp then asks who
// to send to, which keeps phone numbers out of the page's HTML.
const RemindButton = ({ name, amount, court, venueName, when }: {
  name: string
  amount: string
  court: string
  venueName: string
  when: string
}) => {
  const message = `Hey ${name.split(' ')[0]} — your share for ${court} at ${venueName}, ${when} is ${amount}.\n\nYou can pay it here: ${typeof window === 'undefined' ? '' : window.location.origin}/mybookings`
  return (
    <a
      href={`https://wa.me/?text=${encodeURIComponent(message)}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      title={`Open WhatsApp with a reminder for ${name.split(' ')[0]} — nothing sends until you do`}
      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap"
      style={{ background: '#25D36624', border: '1px solid #25D36680', color: '#25D366' }}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2zm5.2 14.1c-.2.6-1.2 1.2-1.7 1.2-.5.1-1 .1-1.6-.1-.4-.1-.9-.3-1.5-.6-2.6-1.1-4.3-3.8-4.4-4-.1-.2-1-1.4-1-2.6s.6-1.8.9-2.1c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5s.8 1.9.8 2 .1.3 0 .4l-.3.5-.4.4c-.1.1-.3.3-.1.6s.6 1.1 1.4 1.8c1 .9 1.8 1.1 2 1.2s.4.1.6-.1.7-.8.9-1.1.4-.2.6-.1 1.5.7 1.8.8.4.2.5.3 0 .7-.3 1.3z"/></svg>
      Remind
    </a>
  )
}

function paymentLabel(method: string, stripeId: string | null) {
  if (method === 'card' && stripeId) return { label: 'Paid', color: 'var(--brand-primary-text)' }
  if (method === 'card' && !stripeId) return { label: 'Payment pending', color: 'var(--text-muted)' }
  if (method === 'credits') return { label: 'Paid with credits', color: 'var(--brand-primary-text)' }
  if (method === 'membership_allowance') return { label: 'Membership', color: 'var(--brand-primary-text)' }
  if (method === 'staff_block') return { label: 'Staff block', color: 'var(--text-muted)' }
  return { label: method, color: 'var(--text-muted)' }
}

function durationLabel(mins: number) {
  if (mins === 30) return '30 min'
  if (mins === 60) return '60 min'
  if (mins === 90) return '90 min'
  if (mins === 120) return '120 min'
  return mins + ' min'
}

function dateParts(dateStr: string) {
  const date = new Date(dateStr + 'T00:00:00')
  return {
    month: new Intl.DateTimeFormat('en-NZ', { month: 'short' }).format(date),
    day: date.getDate(),
    weekday: new Intl.DateTimeFormat('en-NZ', { weekday: 'short' }).format(date),
  }
}

// The blue court tile at the left of every booking: same look as the ticket in Book a court, just smaller.
const MiniCourt = ({ name, muted }: { name: string | null | undefined; muted?: boolean }) => {
  const bare = String(name ?? '').replace(/^court\s*/i, '').trim()
  const short = bare.length > 0 && bare.length <= 3 ? bare : bare.slice(0, 1).toUpperCase() || '?'
  return (
    <div aria-hidden className="shrink-0 flex flex-col items-center justify-center text-white" data-testid="booking-court"
      style={{ width: 52, height: 52, borderRadius: 16, background: muted ? 'linear-gradient(160deg, #3a4150, #2b313c)' : 'linear-gradient(160deg, #2c5fc4, #1d3f8d)' }}>
      <span className="font-black" style={{ fontSize: 8, letterSpacing: '0.12em', color: '#cfe0ff' }}>COURT</span>
      <span className="font-black leading-none" style={{ fontSize: short.length > 2 ? 15 : 22 }}>{short}</span>
    </div>
  )
}

const longDate = (dateStr: string) => { const p = dateParts(dateStr); return `${p.weekday} ${p.day} ${p.month}` }

const DirectionsButton = ({ address }: { address: string }) => (
  <a
    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center justify-center gap-1.5 text-xs font-medium px-4 py-2 rounded-xl transition-all whitespace-nowrap"
    style={{ background: 'var(--bg-raised)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
    onClick={e => e.stopPropagation()}
  >
    {/* Icon carries the colour, the chip stays neutral: these two sit above
        Reschedule and Cancel, and tinting the whole chip would put them in
        competition with the actions that move money. */}
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--brand-blue)' }}><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
    Directions
  </a>
)

const AddToCalendarButton = ({ booking, courtLabel, venueAddress }: {
  booking: { id: string; date: string; start_time: string; end_time: string }
  courtLabel: string
  venueAddress: string
}) => (
  <a
    href={buildBookingIcsDataUri({
      uid: booking.id,
      title: `${courtLabel} — PadelMate`,
      description: 'Padel court booking',
      location: venueAddress,
      date: booking.date,
      startTime: booking.start_time,
      endTime: booking.end_time,
    })}
    download={`padelmate-${booking.date}.ics`}
    className="inline-flex items-center justify-center gap-1.5 text-xs font-medium px-4 py-2 rounded-xl transition-all whitespace-nowrap"
    style={{ background: 'var(--bg-raised)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
    onClick={e => e.stopPropagation()}
  >
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--brand-yellow)' }}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>
    Add to calendar
  </a>
)

const BookAgainButton = ({ courtId, durationMinutes }: { courtId: string; durationMinutes: number }) => (
  <Link
    href={`/book?courtId=${courtId}&duration=${durationMinutes}`}
    className="text-xs font-semibold px-2.5 py-1.5 rounded-lg"
    style={{ background: 'var(--brand-primary-muted)', color: 'var(--brand-primary-text)', border: '1px solid var(--brand-primary)' }}
  >
    Book again
  </Link>
)

// "Book again" only ever appeared on a past booking, which lives behind the
// Past tab -- so the one moment a player is most likely to book, having just
// finished a game and having nothing else in the diary, was a dead end
// reading "No upcoming bookings". This is that moment, with their last court
// already in hand.
//
// It deliberately doesn't claim to re-book the same time: the flow can carry
// a court and a duration through, but the date and time still have to be
// picked, and promising otherwise would make the next screen feel broken.
const PlayAgainCard = ({ booking }: { booking: BookingWithCourt }) => {
  const court = booking.courts?.name ?? 'your court'
  const { weekday } = dateParts(booking.date)
  return (
    <div className="rounded-2xl px-5 py-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--brand-primary)' }}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-base"
          style={{ background: 'var(--brand-primary-muted)' }}>
          🎾
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[15px]" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display), Manrope, sans-serif', fontWeight: 700 }}>
            Same again?
          </div>
          <div className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            You last played {court} on {weekday} at {fmtClock(booking.start_time)}. Pick a date and we&apos;ll keep the court and the {booking.duration_minutes} minutes.
          </div>
          <Link
            href={`/book?courtId=${booking.court_id}&duration=${booking.duration_minutes}`}
            className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl mt-3"
            style={{ background: 'var(--brand-primary)', color: 'var(--brand-primary-on)' }}
          >
            Book {court} again
            <span style={{ fontSize: 13 }}>→</span>
          </Link>
        </div>
      </div>
    </div>
  )
}

// Recording a result used to mean going to Record a match and picking all four
// players out of the member list, for a game whose players this booking
// already knows. From here the form arrives with them filled in.
const RecordResultButton = ({ bookingId }: { bookingId: string }) => (
  <Link
    href={`/record-match?bookingId=${bookingId}`}
    className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg"
    style={{ background: 'var(--bg-raised)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
  >
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--brand-yellow)' }}><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M6 4h12v5a6 6 0 0 1-12 0z"/><path d="M12 15v4M8 21h8"/></svg>
    Record result
  </Link>
)

export type RegularSeries = { id: string; venue_slug: string; start_time: string; duration_minutes: number; start_date: string; weeks: number; clash_dates: string[] | null; status: string }

const fmtWhen = (ms: number, tz: string) =>
  `${new Intl.DateTimeFormat('en-NZ', { timeZone: tz, weekday: 'short' }).format(new Date(ms))} ${clockAt(ms, tz)}`

// "Now" only exists in the browser, so these render nothing until the page has loaded.
function useNow(): number | null {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => { setNow(Date.now()) }, [])
  return now
}

// What a friend sees on a share they owe: pay by when, or that it is overdue.
function ShareDeadlineHint({ date, startTime, createdAt, venueSlug }: { date: string; startTime: string; createdAt?: string; venueSlug?: string }) {
  const now = useNow()
  if (now === null || !createdAt) return null
  const tz = timezoneForVenueSlug(venueSlug)
  const startMs = venueInstant(date, `${startTime.slice(0, 5)}:00`, tz).getTime()
  const sched = shareSchedule(startMs, Date.parse(createdAt))
  if (!sched || startMs <= now) return null
  const late = shareStage(sched, now) !== 'before'
  return (
    <div className="text-[11px] font-bold mt-1" data-testid="share-hint" style={{ color: late ? 'var(--brand-crimson)' : 'var(--brand-yellow)' }}>
      {late ? 'Overdue. The person who booked has been asked to cover it.' : `Pay by ${fmtWhen(sched.deadline, tz)}, or they will be asked to cover it.`}
    </div>
  )
}

// What the booker sees when friends still owe: the deadline, and a button to
// cover the rest so the court is safe. After the deadline it is the main thing on the row.
function ShareDeadlineBox({ booking, shares }: { booking: BookingWithCourt; shares: OutgoingSplit[] }) {
  const now = useNow()
  const [busy, setBusy] = useState(false)
  const pending = shares.filter(s => s.status === 'pending')
  if (now === null || pending.length === 0) return null
  const slug = (booking.courts as any)?.venue_slug
  const tz = timezoneForVenueSlug(slug)
  const startMs = venueInstant(booking.date, `${booking.start_time.slice(0, 5)}:00`, tz).getTime()
  if (startMs <= now) return null
  const sched = booking.created_at && !booking.share_deadline_exempt ? shareSchedule(startMs, Date.parse(booking.created_at)) : null
  const stage = sched ? shareStage(sched, now) : 'before'
  const currency = currencyForRegion(VENUES.find(v => v.slug === slug)?.region)
  const amount = formatPrice(coverCents(booking.price_nzd, shares.length, pending.length) / 100, currency)
  const cover = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/split-cover', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingId: booking.id }) })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body.url) { toast.error(body.error ?? 'Could not open payment. Please try again.'); return }
      window.location.href = body.url
    } catch {
      toast.error('Could not open payment. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  const urgent = stage !== 'before'
  return (
    <div className="rounded-[20px] mt-2.5 p-5 flex flex-wrap items-center justify-between gap-4" data-testid="share-deadline"
      style={{ background: (urgent || !sched) ? 'var(--brand-yellow-muted)' : 'var(--bg-raised)', border: `${(urgent || !sched) ? 1.5 : 1}px solid ${(urgent || !sched) ? 'var(--brand-yellow)' : 'var(--border)'}` }}>
      <div className="min-w-0 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        {urgent && sched
          ? <><b style={{ color: 'var(--brand-yellow)' }}>{pending.length === 1 ? 'A share is' : `${pending.length} shares are`} still unpaid.</b> {stage === 'cover' ? <>Cover {amount} by {fmtWhen(sched.coverUntil, tz)} or</> : <>Cover {amount} now or</>} the court is released and everyone is refunded.</>
          : sched
          ? <>Friends pay by <b style={{ color: 'var(--text-primary)' }}>{fmtWhen(sched.deadline, tz)}</b>. After that you can cover what is left ({amount}), or the court is released.</>
          : <><span className="block text-[17px] sm:text-[18px] font-extrabold" style={{ color: 'var(--open-text)' }}>{pending.length === 1 ? 'A share is' : `${pending.length} shares are`} still unpaid</span><span className="block text-[13px] mt-0.5" style={{ color: 'var(--text-muted)' }}>You can cover {pending.length === 1 ? 'it' : 'them'} for <b style={{ color: 'var(--text-primary)' }}>{amount}</b></span></>}
      </div>
      <button onClick={cover} disabled={busy} className="rounded-full px-3.5 text-xs font-bold disabled:opacity-50 shrink-0 w-full sm:w-auto"
        style={{ minHeight: 40, ...(urgent || !sched ? GO : { background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }) }}>
        {busy ? 'Opening…' : `Cover ${amount}`}
      </button>
    </div>
  )
}

// Open Stripe checkout for a booking that is held but not yet paid.
async function startCheckout(b: BookingWithCourt): Promise<void> {
  try {
    const res = await fetch('/api/create-checkout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId: b.id, courtName: `${b.courts?.name ?? 'Court'} — ${b.courts?.type ?? ''}`, date: formatDate(b.date), time: fmtClockRange(b.start_time, b.end_time) }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok || body.error || !body.url) { toast.error(body.error ?? 'Could not open payment. Please try again.'); return }
    window.location.href = body.url
  } catch {
    toast.error('Could not open payment. Please try again.')
  }
}

const fmtShort = (date: string) => new Intl.DateTimeFormat('en-NZ', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(date + 'T12:00:00Z'))
const fmtPayBy = (iso: string, tz: string) => new Intl.DateTimeFormat('en-NZ', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso))

// One card per weekly regular: the slot, how much of it is booked, each week to
// come, and the two things a player does with it -- skip a week, or stop.
function RegularCard({ series: r, bookings, onSkip, prepayOn = false }: { series: RegularSeries; bookings: BookingWithCourt[]; onSkip: (bookingId: string) => void; prepayOn?: boolean }) {
  const router = useRouter()
  const [sheet, setSheet] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [payingAll, setPayingAll] = useState(false)
  const tz = timezoneForVenueSlug(r.venue_slug)
  const rule = useRule(r.venue_slug)
  const nowMs = Date.now()
  const rows = weekRows(r, bookings.filter(b => b.regular_id === r.id) as any, tz, nowMs)
  const coming = upcomingWeeks(rows)
  const shown = showAll ? coming : coming.slice(0, 4)
  const skippable = coming.filter(w => w.bookingId && (w.kind === 'paid' || w.kind === 'due') && canSkipWeek(w.date, r.start_time, tz, nowMs, rule.freeHours))
  const club = VENUES.find(v => v.slug === r.venue_slug)?.name ?? r.venue_slug
  const startLabel = r.start_time.slice(0, 5)
  const endMin = Number(startLabel.slice(0, 2)) * 60 + Number(startLabel.slice(3, 5)) + r.duration_minutes
  const endLabel = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`
  const lastDate = seriesDates(r.start_date, r.weeks)[r.weeks - 1]

  const stop = async () => {
    if (!confirm('Stop this regular?\n\nWeeks you have not paid for yet will be let go. Weeks you paid for in advance, a day or more away, are refunded to your card. Other paid weeks stay booked.')) return
    setStopping(true)
    try {
      const res = await fetch('/api/regulars/stop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id }) })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(body.error ?? 'Could not stop your regular. Please try again.'); return }
      const back = body.refunded > 0 ? ` ${body.refunded === 1 ? '1 week was' : `${body.refunded} weeks were`} refunded to your card.` : ''
      toast.success(body.keptPaid > 0 ? `Regular stopped. Your ${body.keptPaid === 1 ? 'paid week stays' : 'paid weeks stay'} booked.${back}` : `Regular stopped.${back}`)
      router.refresh()
    } catch {
      toast.error('Could not stop your regular. Please try again.')
    } finally {
      setStopping(false)
    }
  }

  const dueWeeks = coming.filter(w => w.kind === 'due' && w.bookingId)
  const payAll = async () => {
    setPayingAll(true)
    try {
      const res = await fetch('/api/regulars/pay-all', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ regularId: r.id }) })
      const body = await res.json().catch(() => ({}))
      if (res.ok && body.url) { window.location.href = body.url; return }
      toast.error(body.error ?? 'Could not open the payment. Please try again.')
    } catch {
      toast.error('Could not open the payment. Please try again.')
    } finally {
      setPayingAll(false)
    }
  }

  const pill = (w: WeekRow) => w.kind === 'paid' ? { t: '✓ Paid', bg: 'var(--brand-green-muted)', c: 'var(--brand-green)' }
    : w.kind === 'due' ? { t: w.payBy ? `Pay by ${fmtPayBy(w.payBy, tz)}` : 'Pay now', bg: 'var(--brand-yellow-muted)', c: 'var(--brand-yellow)' }
    : w.kind === 'taken' ? { t: 'Taken', bg: 'var(--bg-raised)', c: 'var(--text-muted)' }
    : { t: 'Skipped', bg: 'var(--bg-raised)', c: 'var(--text-muted)' }

  return (
    <div className="rounded-2xl p-4" data-testid="regular-series" style={{ background: 'var(--bg-surface)', border: '1px solid var(--brand-primary)', boxShadow: 'var(--shadow-float)' }}>
      <span className="inline-block text-[10px] font-extrabold rounded-full px-2 py-0.5" style={{ background: 'var(--brand-primary-muted)', color: 'var(--brand-primary-text)', letterSpacing: '0.06em' }}>🔁 REGULAR</span>
      <div className="text-lg mt-2" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display), Manrope, sans-serif', fontWeight: 700 }}>
        Every {weekdayPlural(r.start_date).slice(0, -1)} · {fmtClockRange(startLabel, endLabel)}
      </div>
      <div className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        {club}<br />Held until {fmtShort(lastDate)} · {bookedWeekCount(rows)} of {r.weeks} weeks booked
      </div>
      {shown.length > 0 && (
        <div className="mt-3">
          {shown.map(w => {
            const p = pill(w)
            const booking = w.kind === 'due' ? bookings.find(b => b.id === w.bookingId) : null
            return (
              <div key={w.date} className="flex items-center justify-between gap-2 py-2 text-sm" style={{ borderTop: '1px solid var(--border)', opacity: w.kind === 'skipped' || w.kind === 'taken' ? 0.65 : 1 }}>
                <span style={{ color: 'var(--text-primary)' }}>{fmtShort(w.date)}</span>
                {booking ? (
                  <span className="flex items-center justify-end gap-2 flex-wrap">
                    {w.payBy && <span className="text-[11px] font-bold rounded-full px-2.5 py-1 whitespace-nowrap" style={{ background: p.bg, color: p.c }}>{p.t}</span>}
                    <button onClick={() => startCheckout(booking)} aria-label={`Pay for ${fmtShort(w.date)}`} className="text-xs font-extrabold rounded-full px-3.5 py-1.5 whitespace-nowrap" style={{ background: '#DC2626', color: '#FFFFFF' }}>Pay now</button>
                  </span>
                ) : (
                  <span className="text-[11px] font-bold rounded-full px-2.5 py-1 whitespace-nowrap" style={{ background: p.bg, color: p.c }}>{p.t}</span>
                )}
              </div>
            )
          })}
          {coming.length > 4 && (
            <button onClick={() => setShowAll(a => !a)} className="text-xs font-semibold pt-1" style={{ color: 'var(--brand-primary-text)' }}>
              {showAll ? 'Show fewer weeks' : `Show all ${coming.length} weeks`}
            </button>
          )}
        </div>
      )}
      {prepayOn && dueWeeks.length > 1 && (
        <button onClick={payAll} disabled={payingAll} data-testid="pay-all-due"
          className="w-full rounded-xl text-sm font-bold mt-3 disabled:opacity-40" style={{ minHeight: 44, background: 'var(--brand-primary)', color: 'var(--brand-primary-on)' }}>
          {payingAll ? 'Opening payment…' : `Pay all ${dueWeeks.length} weeks now`}
        </button>
      )}
      <div className="flex gap-2 mt-3">
        <button onClick={() => setSheet(true)} disabled={skippable.length === 0}
          className="flex-1 rounded-xl text-sm font-bold disabled:opacity-40" style={{ minHeight: 44, background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
          Skip a week
        </button>
        <button onClick={stop} disabled={stopping}
          className="flex-1 rounded-xl text-sm font-bold disabled:opacity-40" style={{ minHeight: 44, background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
          {stopping ? 'Stopping…' : 'Stop regular'}
        </button>
      </div>
      {sheet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Skip a week" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={() => setSheet(false)}>
          <div className="w-full max-w-md rounded-3xl p-5 overflow-y-auto" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', maxHeight: 'calc(100dvh - 2rem)', boxShadow: '0 30px 80px -10px rgba(0,0,0,0.6)' }} onClick={e => e.stopPropagation()}>
            <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Skip a week</div>
            <p className="text-sm mt-1 mb-4" style={{ color: 'var(--text-muted)' }}>The court goes back on sale and anyone waiting for it is told. You keep your regular.</p>
            <div className="grid grid-cols-2 gap-2">
              {skippable.map(w => (
                <button key={w.date} onClick={() => { setSheet(false); onSkip(w.bookingId!) }}
                  data-kind={w.kind}
                  className="rounded-xl py-3 text-sm font-bold"
                  style={{ background: w.kind === 'paid' ? 'var(--brand-green-muted)' : 'var(--brand-yellow-muted)', border: `1.5px solid ${w.kind === 'paid' ? 'var(--brand-green)' : 'var(--brand-yellow)'}`, color: 'var(--text-primary)' }}>
                  {fmtShort(w.date)}
                  <div className="text-[10px] font-bold" style={{ color: w.kind === 'paid' ? 'var(--brand-green)' : 'var(--brand-yellow)' }}>{w.kind === 'paid' ? '✓ Paid' : 'Not paid yet'}</div>
                </button>
              ))}
            </div>
            <p className="text-xs mt-3 text-center" style={{ color: 'var(--text-subtle)' }}>You can skip a week up to {hoursWord(rule.freeHours)} before it starts, the same as cancelling. A week you have already paid for is refunded.</p>
            <button onClick={() => setSheet(false)} className="w-full mt-2 py-2.5 text-sm" style={{ color: 'var(--text-subtle)' }}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}

export type WaitingFor = { id: string; venue_slug: string; date: string; start_time: string; duration_minutes: number; status: string }

// Full times the player asked to be told about. "Notified" ones lead with a
// book-it button: a court has opened and nobody is holding it.
function WaitingCard({ waits }: { waits: WaitingFor[] }) {
  const router = useRouter()
  const [stopping, setStopping] = useState<string | null>(null)
  const [hidden, setHidden] = useState<string[]>([])
  const rows = waits.filter(w => !hidden.includes(w.id))
  if (rows.length === 0) return null
  const stop = async (id: string) => {
    setStopping(id)
    try {
      const res = await fetch('/api/waitlist/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
      if (!res.ok) { toast.error('Could not stop waiting. Please try again.'); return }
      setHidden(h => [...h, id])
      toast.success('You are no longer waiting for that time.')
      router.refresh()
    } catch {
      toast.error('Could not stop waiting. Please try again.')
    } finally {
      setStopping(null)
    }
  }
  const clubName = (slug: string) => VENUES.find(v => v.slug === slug)?.name ?? slug
  return (
    <div className="mt-4" data-testid="waiting-card">
      <div className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-subtle)' }}>🔔 Waiting for</div>
      <div className="space-y-4">
        {rows.map(w => {
          const [h, m] = w.start_time.slice(0, 5).split(':').map(Number)
          const end = h * 60 + m + w.duration_minutes
          const endLabel = `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`
          const opened = w.status === 'notified'
          return (
            <div key={w.id} className="rounded-2xl p-3.5 flex items-center gap-3" style={{ background: 'var(--bg-surface)', border: `1px ${opened ? 'solid' : 'dashed'} ${opened ? 'var(--brand-primary)' : 'var(--border)'}` }}>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{clubName(w.venue_slug)}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {formatDate(w.date)}, {fmtClockRange(w.start_time, endLabel)} · {opened ? 'A court opened. Book it now.' : 'We will tell you if it opens'}
                </div>
              </div>
              {opened && <Link href="/book?wl=1" className="rounded-full px-3 text-xs font-bold flex items-center" style={{ minHeight: 40, background: 'var(--brand-primary)', color: '#fff' }}>Book</Link>}
              <button onClick={() => stop(w.id)} disabled={stopping === w.id} className="rounded-full px-3 text-xs font-bold" style={{ minHeight: 40, background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                {stopping === w.id ? 'Stopping…' : 'Stop'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MyBookingsListInner({
  bookings,
  profile,
  splitRequests = [],
  pastUnpaid = [],
  pastRefunded = [],
  outgoingSplits = [],
  joinedGames = [],
  currentUserId,
  stripeDashboardBase,
  venueSettings = {},
  waits = [],
  regulars = [],
  sharesOn = false,
  prepayOn = false,
  plan = null,
}: {
  bookings: BookingWithCourt[]
  profile: Profile
  splitRequests?: SplitRequest[]
  // Unpaid shares on games that are already over: nothing is owed on them, so they only show in Past.
  pastUnpaid?: SplitRequest[]
  // Shares the player paid on a game that was then cancelled: the money went back to their card.
  pastRefunded?: SplitRequest[]
  outgoingSplits?: OutgoingSplit[]
  joinedGames?: JoinedGame[]
  currentUserId?: string
  // Supplied by the server page: whether receipts point at Stripe's test or
  // live dashboard depends on which secret key the deployment holds, and that
  // key must never reach the browser.
  stripeDashboardBase: string
  // Each club's opening hours, for rescheduling.
  venueSettings?: VenueSettingsMap
  // Times the player is waiting on (full times they asked to be told about).
  waits?: WaitingFor[]
  // The player's active weekly regulars.
  regulars?: RegularSeries[]
  // Whether unpaid shares have a deadline (the share-deadline database change has been run).
  sharesOn?: boolean
  prepayOn?: boolean
  // The member's plan at their home club, from the server page.
  plan?: { name: string; windowDays: number } | null
}) {
  const router = useRouter()
  const rules = useContext(RulesCtx)
  const searchParams = useSearchParams()
  // Stripe sends the booker back here with ?payment=success. That is the one
  // moment a reminder is obviously worth having, so the permission ask leans
  // on it rather than waiting to be found in the navbar.
  const justPaid = searchParams?.get('payment') === 'success' || searchParams?.get('split') === 'paid'
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [payingSplit, setPayingSplit] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  // The member's plan at their home club (name and how many days ahead they can book).
  const legacy = MEMBERSHIP_CONFIG[profile?.membership_tier ?? 'casual'] ?? MEMBERSHIP_CONFIG['casual']
  const mem = { name: plan?.name ?? legacy.name ?? tierLabel(profile?.membership_tier), bookingWindowDays: bookAhead(plan?.windowDays ?? legacy.bookingWindowDays) }
  const now = new Date()
  // Booking times are the club's wall clock. "Has it ended" and "what is today" are worked out in the club's
  // time zone, not the viewer's, so the server (UTC) and the player's phone always agree and the page does not
  // flip between "This week" and "Next week" while it loads.
  const homeSlug: string | null = (profile as any)?.home_venue_slug ?? null
  const hasEnded = (date: string, endTime: string, venueSlug?: string | null) =>
    venueInstant(date, String(endTime), timezoneForVenueSlug(venueSlug ?? homeSlug)).getTime() <= now.getTime()
  const upcoming = bookings.filter(b => b.status !== 'cancelled' && !hasEnded(b.date, b.end_time, (b.courts as any)?.venue_slug))
  // One rule line under the list: the clubs these bookings are at, when they all share a rule.
  const footerRules = Array.from(new Set(upcoming.map(b => (b.courts as any)?.venue_slug as string | undefined))).map(slug => rules[slug ?? ''] ?? DEFAULT_RULE)
  const footerRule = footerRules.length > 0 && footerRules.every(x => x.freeHours === footerRules[0].freeHours && x.after === footerRules[0].after) ? footerRules[0] : footerRules.length === 0 ? DEFAULT_RULE : null
  const past = bookings.filter(b => b.status === 'cancelled' || hasEnded(b.date, b.end_time, (b.courts as any)?.venue_slug))
  const upcomingJoined = joinedGames.filter(j => j.bookings && !hasEnded(j.bookings.date, j.bookings.end_time, (j.bookings as any).courts?.venue_slug))
  const pastJoined = joinedGames.filter(j => j.bookings && hasEnded(j.bookings.date, j.bookings.end_time, (j.bookings as any).courts?.venue_slug))
  const nameOf = (p: { nickname: string | null; full_name: string | null } | null) => p?.nickname ?? p?.full_name ?? null
  const pastOwn: PastOwn[] = past.map(b => ({ id: b.id, date: b.date, startTime: b.start_time, court: b.courts?.name ?? 'Court', venueSlug: (b.courts as any)?.venue_slug ?? null, status: b.status, price: Number(b.price_nzd) || 0, method: b.payment_method, stripeId: b.stripe_payment_id, refundCents: (b as any).refund_cents ?? null, refundKind: (b as any).refund_kind ?? null }))
  const pastJoinedPaid: PastShare[] = pastJoined.map(j => ({ id: j.id, date: j.bookings!.date, startTime: j.bookings!.start_time, court: j.bookings!.courts?.name ?? 'Court', venueSlug: j.bookings!.courts?.venue_slug ?? null, amount: Number(j.amount_nzd) || 0, from: nameOf(j.profiles) }))
  const pastUnpaidShares: PastShare[] = pastUnpaid.filter(s => s.bookings?.date).map(s => ({ id: s.id, date: s.bookings!.date, startTime: s.bookings!.start_time, court: s.bookings!.courts?.name ?? 'Court', venueSlug: s.bookings!.courts?.venue_slug ?? null, amount: Number(s.amount_nzd) || 0, from: nameOf(s.profiles) }))
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: timezoneForVenueSlug(homeSlug) }).format(now)
  const pastRefundedShares: PastShare[] = pastRefunded.filter(s => s.bookings?.date).map(s => ({ id: s.id, date: s.bookings!.date, startTime: s.bookings!.start_time, court: s.bookings!.courts?.name ?? 'Court', venueSlug: s.bookings!.courts?.venue_slug ?? null, amount: Number(s.amount_nzd) || 0, from: nameOf(s.profiles) }))
  const pastCount = buildPastHistory({ own: pastOwn, joinedPaid: pastJoinedPaid, unpaid: pastUnpaidShares, refunded: pastRefundedShares, year: todayStr.slice(0, 4) }).reduce((t, m) => t + m.items.length, 0)
  const hasUpcoming = upcoming.length > 0 || upcomingJoined.length > 0
  // "You're booked!" after paying for a booking: the booking just made is the newest upcoming one.
  const paidBooking = searchParams?.get('payment') === 'success'
    ? [...upcoming].sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))[0] ?? null
    : null
  const celebrate = searchParams?.get('payment') === 'success' && !!paidBooking
  // The most recent game actually played, for the "Same again?" card. A
  // cancelled booking was never a game, so it isn't a court to offer back.
  const lastPlayed = past
    .filter(b => b.status !== 'cancelled')
    .sort((a, b) => (b.date + b.start_time).localeCompare(a.date + a.start_time))[0] ?? null

  const handleCancel = async (id: string) => {
    const booking = bookings.find(b => b.id === id)
    if (!booking) return
    // The court's clock, the same way the server works it out. Using the
    // browser's zone instead was right for a member sitting in the venue's
    // country and wrong for one who isn't -- and either way it was a second
    // opinion, which is how this dialog came to promise 50% on bookings the
    // server then refunded in full.
    const hoursUntil = hoursUntilBooking(
      booking.date,
      booking.start_time,
      (booking.courts as any)?.venue_slug,
    )
    const isPaid = !!(booking as any).stripe_payment_id
    const currency = currencyForRegion(VENUES.find(v => v.slug === (booking.courts as any)?.venue_slug)?.region)
    // Quote 50% of what this member paid, not 50% of the court fee -- on a
    // split booking they were only ever charged their own share of it.
    const bookingSplits = outgoingSplits.filter(s => s.booking_id === booking.id)
    const yourShare = bookerShareCents(booking.price_nzd, bookingSplits.length + 1) / 100
    // Everyone else on the booking is refunded in full whatever the notice,
    // so say so -- cancelling is a lot easier to face when you know you
    // aren't leaving your mates out of pocket.
    const othersNote = bookingSplits.some(s => s.status === 'paid')
      ? '\n\nEveryone else on this booking is refunded in full.'
      : ''
    const rule = rules[(booking.courts as any)?.venue_slug] ?? DEFAULT_RULE
    const outcome = cancelOutcome(hoursUntil, rule)
    const policy = !isPaid
      ? 'Cancel this booking?\n\nNo payment has been charged yet, so this will simply be cancelled with no charge or credit.' + othersNote
      : outcome === 'full'
      ? 'Cancel this booking?\n\nSince it is more than ' + hoursWord(rule.freeHours) + ' away you will receive a FULL REFUND to your card within 5-10 business days.' + othersNote
      : outcome === 'half'
      ? 'Cancel this booking?\n\nSince it is less than ' + hoursWord(rule.freeHours) + ' away you will only receive 50% back (' + formatPrice(yourShare * 0.5, currency) + ') as account credit.' + othersNote
      : 'Cancel this booking?\n\nSince it is less than ' + hoursWord(rule.freeHours) + ' away the club keeps the payment, so nothing comes back.' + othersNote
    if (!confirm(policy)) return
    setCancelling(id)
    const res = await fetch('/api/cancel-booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId: id }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? 'Could not cancel — please try again.')
    } else {
      const receiptUrl = isPaid ? `${stripeDashboardBase}/${(booking as any).stripe_payment_id}` : null
      const othersRefunded = data.splitsRefunded > 0
        ? ` Your other ${data.splitsRefunded === 1 ? 'player has' : 'players have'} been refunded in full.`
        : ''
      const message = data.refundFailed
        ? 'Booking cancelled, but your refund could not be processed automatically — please contact support so we can sort it out.'
        : !data.isPaid
        ? 'Booking cancelled.' + othersRefunded
        : !isFree(data.hoursUntil, rule)
        ? (data.creditAmount > 0 ? 'Booking cancelled. ' + formatPrice(data.creditAmount, currency) + ' credit added to your account.' : "Booking cancelled. Under the club's cancellation rule the payment was kept.") + othersRefunded
        : 'Booking cancelled. Full refund will appear on your card in 5-10 business days.' + othersRefunded
      if (data.refundFailed) {
        toast.error(message, { duration: 8000 })
        router.refresh()
        setCancelling(null)
        return
      }
      toast.success(
        receiptUrl ? (
          <span>
            {message}{' '}
            <a href={receiptUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline', fontWeight: 600 }}>
              View receipt ↗
            </a>
          </span>
        ) : message,
        { duration: receiptUrl ? 8000 : 4000 }
      )
      router.refresh()
    }
    setCancelling(null)
  }

  return (
    <div>
      {splitRequests.length > 0 && (
        <div className="rounded-2xl p-4 mb-6" style={{ background: 'var(--brand-crimson-muted)', border: '1px solid var(--brand-crimson)' }}>
          <div className="text-sm font-extrabold mb-3 uppercase tracking-wide" style={{ color: 'var(--brand-crimson)' }}>Outstanding split requests</div>
          <div className="space-y-4">
            {splitRequests.map(s => {
              const who = s.profiles?.nickname ?? s.profiles?.full_name ?? 'Someone'
              const court = s.bookings?.courts?.name ?? 'a court'
              const date = s.bookings?.date ? formatDate(s.bookings.date) : ''
              const time = s.bookings?.start_time ? fmtClock(s.bookings.start_time) : ''
              // A share is a slice of the court fee, which is already in the
              // venue's own currency -- and pay-split charges it in that
              // currency. Formatting as NZD showed a South African "$37.00"
              // for a charge Stripe puts through as R37.00.
              const splitCurrency = currencyForRegion(
                VENUES.find(v => v.slug === s.bookings?.courts?.venue_slug)?.region,
              )
              return (
                <div key={s.id} className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium" style={{ color: 'var(--brand-crimson)' }}>You owe {who} {formatPrice(s.amount_nzd, splitCurrency)}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{court} · {date} · {time}</div>
                    {sharesOn && !s.bookings?.share_deadline_exempt && s.bookings?.date && s.bookings.start_time && <ShareDeadlineHint date={s.bookings.date} startTime={s.bookings.start_time} createdAt={s.bookings.created_at} venueSlug={s.bookings.courts?.venue_slug} />}
                  </div>
                  <button
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg shrink-0"
                    style={{ background: 'var(--brand-crimson)', color: '#fff' }}
                    disabled={payingSplit === s.id}
                    onClick={async () => {
                      setPayingSplit(s.id)
                      const court = s.bookings?.courts?.name ?? 'Court'
                      const date = s.bookings?.date ?? ''
                      const time = s.bookings?.start_time ? fmtClock(s.bookings.start_time) : ''
                      const invitedByName = s.profiles?.nickname ?? s.profiles?.full_name ?? 'Someone'
                      const res = await fetch('/api/pay-split', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ splitId: s.id, courtName: court, date, time, invitedByName }),
                      })
                      const { url, error } = await res.json()
                      if (error) { toast.error(error); setPayingSplit(null); return }
                      window.location.href = url
                    }}
                  >
                    {payingSplit === s.id ? 'Loading...' : `Pay ${formatPrice(s.amount_nzd, splitCurrency)}`}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {celebrate && paidBooking && (() => {
        const venueSlug = (paidBooking.courts as any)?.venue_slug
        const currency = currencyForRegion(VENUES.find(v => v.slug === venueSlug)?.region)
        const splits = outgoingSplits.filter(x => x.booking_id === paidBooking.id)
        const share = bookerShareCents(paidBooking.price_nzd, splits.length + 1) / 100
        return (
          <BookedCelebration firstName={String(profile?.full_name ?? '').split(' ')[0]} onDone={() => router.replace('/mybookings')}
            ticket={{ courtName: paidBooking.courts?.name ?? 'Court', dateLabel: formatDate(paidBooking.date), time: fmtClock(paidBooking.start_time), endTime: fmtUntil(paidBooking.start_time, paidBooking.end_time),
              lengthLabel: durationLabel(paidBooking.duration_minutes), venueName: VENUES.find(v => v.slug === venueSlug)?.name ?? '', you: profile?.full_name ?? 'You', price: formatPrice(share, currency) }} />
        )
      })()}

      {/* A quiet line for the two things worth knowing up top: credit to spend, and a paid plan. */}
      {((profile?.credits ?? 0) > 0 || (mem.name && !/casual/i.test(String(mem.name)))) && (
        <div className="flex flex-wrap gap-2 mb-4" data-testid="my-summary">
          {(profile?.credits ?? 0) > 0 && <span className="text-xs font-extrabold rounded-full px-3 py-1.5" style={{ background: 'var(--brand-yellow-muted)', color: 'var(--brand-yellow)' }}>{'$' + (profile?.credits ?? 0)} credit to spend</span>}
          {mem.name && !/casual/i.test(String(mem.name)) && <span className="text-xs font-extrabold rounded-full px-3 py-1.5" style={{ background: 'var(--brand-primary-muted)', color: 'var(--brand-primary-text)' }}>{mem.name} member</span>}
        </div>
      )}

      {hasUpcoming && justPaid && <PushRemindersPrompt highlight />}

      {/* One tab bar that actually switches. "Upcoming" used to appear twice
          on this screen: as the heading of a list that never hid, and again
          on a pill below it that only revealed past bookings — so tapping
          "Upcoming" did nothing visible. */}
      <div className="inline-flex gap-1 p-1 rounded-full mb-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <button onClick={() => setShowHistory(false)} data-on={showHistory ? undefined : 'true'} className="wh-seg text-xs font-bold px-3.5 py-1.5 rounded-full transition-colors"
          style={showHistory ? { color: 'var(--text-subtle)' } : { background: 'var(--bg-raised)', color: 'var(--text-primary)' }}>
          Upcoming · {upcoming.length + upcomingJoined.length}
        </button>
        <button onClick={() => setShowHistory(true)} data-on={showHistory ? 'true' : undefined} className="wh-seg text-xs font-bold px-3.5 py-1.5 rounded-full transition-colors"
          style={showHistory ? { background: 'var(--bg-raised)', color: 'var(--text-primary)' } : { color: 'var(--text-subtle)' }}>
          Past · {pastCount}
        </button>
      </div>

      {!showHistory && regulars.length > 0 && (
        <div className="space-y-4 mb-4" data-testid="regulars">
          {regulars.map(r => <RegularCard key={r.id} series={r} bookings={bookings} onSkip={handleCancel} prepayOn={prepayOn} />)}
        </div>
      )}

      {!showHistory && (
        !hasUpcoming ? (
          lastPlayed ? (
            <PlayAgainCard booking={lastPlayed} />
          ) : (
            <div className="rounded-2xl text-center py-8 text-sm" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              No upcoming bookings — <Link href="/book" style={{ color: 'var(--brand-primary-text)' }}>book a court</Link>
            </div>
          )
        ) : (
          /* Courts you booked and games you joined, in one list. From the
             member's side they're the same thing — somewhere to be this week
             — and keeping them apart meant checking two places to see what
             was on. The row's own badge says which is which. */
          <div className="space-y-5" data-testid="upcoming-list">
            {(() => {
              const today = new Intl.DateTimeFormat('en-CA', { timeZone: timezoneForVenueSlug(homeSlug) }).format(now)
              const items = [
                ...upcoming.map((b, i) => ({ key: b.id, date: b.date, time: b.start_time, node: (
                  <BookingRow key={b.id} booking={b} isNext={i === 0} collapsible onCancel={() => handleCancel(b.id)} cancelling={cancelling === b.id} splits={outgoingSplits.filter(s => s.booking_id === b.id)} bookingWindowDays={mem.bookingWindowDays} stripeDashboardBase={stripeDashboardBase} venueSettings={venueSettings} sharesOn={sharesOn} />
                ) })),
                ...upcomingJoined.map(j => ({ key: j.id, date: j.bookings!.date, time: j.bookings!.start_time, node: <JoinedGameRow key={j.id} game={j} currentUserId={currentUserId} /> })),
              ].sort((x, y) => (x.date + x.time).localeCompare(y.date + y.time))
              return (['This week', 'Next week', 'Later'] as const).map(g => {
                const rows = items.filter(it => weekGroup(it.date, today) === g)
                return rows.length === 0 ? null : (
                  <section key={g} data-testid="week-group">
                    <h3 className="text-[10.5px] font-extrabold uppercase mb-2.5 px-0.5" style={{ letterSpacing: '0.1em', color: 'var(--text-subtle)' }}>{g}</h3>
                    <div className="space-y-4">{rows.map(r => r.node)}</div>
                  </section>
                )
              })
            })()}
          </div>
        )
      )}

      {!showHistory && waits.length > 0 && <WaitingCard waits={waits} />}

      {hasUpcoming && !justPaid && !showHistory && <div className="mt-5"><PushRemindersPrompt highlight={false} /></div>}

      {showHistory && <PastHistory own={pastOwn} joinedPaid={pastJoinedPaid} unpaid={pastUnpaidShares} refunded={pastRefundedShares} year={todayStr.slice(0, 4)} />}

      {/* The line that matters stays visible; the rest opens on demand. */}
      <details className="mt-6 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
        <summary className="cursor-pointer select-none" style={{ listStyle: 'none' }}>
          {footerRule ? policySummary(footerRule) : 'Each club sets its own cancellation rule'} · <span style={{ color: 'var(--brand-primary-text)', fontWeight: 600 }}>Full policy</span>
        </summary>
        <div className="mt-2 pt-2 leading-relaxed mx-auto max-w-md" style={{ borderTop: '1px solid var(--border)' }}>
          {footerRule ? policyDetail(footerRule) : 'The rule for each booking is shown when you cancel or reschedule it. Everyone else on a split booking is refunded in full, whatever the notice.'}
        </div>
      </details>
    </div>
  )
}

function BookingRow({ booking: b, onCancel, cancelling, past, isNext, collapsible, splits = [], bookingWindowDays = 14, stripeDashboardBase, venueSettings = {}, sharesOn = false }: { sharesOn?: boolean; booking: BookingWithCourt; onCancel?: () => void; cancelling?: boolean; past?: boolean; isNext?: boolean; collapsible?: boolean; splits?: OutgoingSplit[]; bookingWindowDays?: number; stripeDashboardBase: string; venueSettings?: VenueSettingsMap }) {
  const router = useRouter()
  // The court's clock, matching the server -- otherwise the Reschedule
  // button offers itself on bookings the API will refuse, or hides on ones
  // it would allow.
  const bookingDateTime = venueInstant(
    b.date,
    b.start_time,
    timezoneForVenueSlug((b.courts as any)?.venue_slug),
  )
  const now = new Date()
  const hoursUntil = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60)
  const canCancel = !past && b.status === 'confirmed' && bookingDateTime > now
  const rule = useRule((b.courts as any)?.venue_slug)
  const canReschedule = canCancel && isFree(hoursUntil, rule)
  const isLateCancel = !isFree(hoursUntil, rule)
  const isPaid = !!b.stripe_payment_id
  const payment = paymentLabel(b.payment_method, b.stripe_payment_id)
  const venue = VENUES.find(v => v.slug === (b.courts as any)?.venue_slug)
  const [showReschedule, setShowReschedule] = useState(false)
  // Every booking starts closed, one line each. Tap one to open it. (A booking with a spot waiting for a
  // friend used to open itself on the share buttons; that left some open and some closed on arrival.)
  const [expanded, setExpanded] = useState(false)
  const muted = !isNext && !past
  const [paying, setPaying] = useState(false)
  const payNow = async () => { setPaying(true); try { await startCheckout(b) } finally { setPaying(false) } }

  // price_nzd is the whole court fee, but a booking with splits only ever
  // charged the booker their own share of it -- see create-checkout, which
  // divides by the split rows + 1 for the booker. Showing the court fee with
  // "Paid" under it read as "you paid $120" when $30 left the account.
  //
  // Rounded in cents the same way create-checkout works out the charge, so
  // this figure always matches the Stripe receipt the link goes to.
  const shareCount = splits.length + 1
  // A share held open for a friend who hasn't joined yet still counts in the
  // split above -- the court fee is divided by every row -- but it has no name
  // to show and no payment to chase, so it is kept apart from the people.
  const members = splits.filter(s => s.user_id)
  const openSeats = past ? [] : splits.filter(s => !s.user_id && s.status === 'pending' && s.invite_token)
  const yourShare = splits.length > 0
    ? bookerShareCents(b.price_nzd, shareCount) / 100
    : null
  const bookingCurrency = currencyForRegion(venue?.region)

  // Every upcoming booking used to be a full card with Directions, Add to
  // calendar, Reschedule and Cancel on it, so three bookings filled the
  // screen with four copies of the same four buttons. The next game stays
  // open, because that is the one people come here to check; the rest are a
  // line each until you ask for more.
  if (collapsible && !expanded) {
    const unpaidCount = splits.filter(s => s.status !== 'paid').length
    const needsPay = !b.stripe_payment_id && !!b.pay_by
    const bareCourt = String(b.courts?.name ?? '').replace(/^court\s*/i, '').trim()
    const namedCourt = !(bareCourt.length > 0 && bareCourt.length <= 3)
    // One chip says the thing worth knowing: friends still owe you, a week is waiting to be paid, it repeats, or it is paid.
    const chip = unpaidCount > 0 ? { text: `${unpaidCount} to pay`, kind: 'owe' }
      : needsPay ? { text: splits.length > 0 ? 'Pay your share' : 'Pay by ' + fmtPayBy(b.pay_by as string, timezoneForVenueSlug((b.courts as any)?.venue_slug)), kind: 'owe' }
      : b.regular_id ? { text: 'Every week', kind: 'reg' }
      : b.stripe_payment_id ? { text: 'Paid', kind: 'paid' } : null
    const chipStyle = chip?.kind === 'owe' ? { background: '#d4f53c', color: '#17240a' }
      : chip?.kind === 'reg' ? { background: 'var(--brand-primary-muted)', color: 'var(--brand-primary-text)' }
      : moneyVars('gain')
    // Today's game is lit white (the same today as the Board), and says so.
    const isToday = new Intl.DateTimeFormat('en-CA', { timeZone: timezoneForVenueSlug((b.courts as any)?.venue_slug) }).format(new Date()) === b.date
    return (
      <button
        onClick={() => setExpanded(true)}
        data-testid="booking-row" data-today={isToday ? 'true' : undefined}
        className="w-full flex items-center gap-3 rounded-[20px] p-4 text-left transition-colors"
        style={isToday ? { background: 'var(--today-grad)', border: '1px solid var(--today-edge)' } : { background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <MiniCourt name={b.courts?.name} />
        <span className="min-w-0 flex-1">
          {isToday
            ? <span data-testid="booking-today" className="inline-block text-[10px] font-extrabold uppercase rounded-lg px-2 py-0.5" style={{ letterSpacing: '0.08em', background: 'var(--today-block-bg)', color: 'var(--today-block-fg)' }}>Today</span>
            : <span className="block text-[10.5px] font-extrabold uppercase" style={{ letterSpacing: '0.08em', color: 'var(--text-muted)' }}>{longDate(b.date)}</span>}
          <span className="block text-[19px] font-black leading-tight" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{fmtClock(b.start_time)}</span>
          <span className="block text-[11.5px] truncate" style={{ color: 'var(--text-muted)' }}>
            {[namedCourt ? b.courts?.name : null, venue ? venue.name.split(' ').slice(-1)[0] : null, durationLabel(b.duration_minutes)].filter(Boolean).join(' · ')}{splits.length > 0 ? ' · split' : ''}
          </span>
        </span>
        <span className="shrink-0 flex flex-col items-end gap-1.5">
          <span className="text-[15px] font-black" style={{ color: 'var(--text-primary)' }}>{formatPrice(Math.round(yourShare ?? b.price_nzd), bookingCurrency)}</span>
          {chip && <span data-testid="booking-chip" data-chip={chip.kind} className={`text-[10px] font-black rounded-full px-2 py-0.5 whitespace-nowrap${chip.kind === 'paid' ? ' money-bubble' : ''}`} style={chipStyle}>{chip.text}</span>}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-subtle)', flexShrink: 0 }}><path d="M6 9l6 6 6-6"/></svg>
      </button>
    )
  }

  const rescheduleModal = showReschedule && venue ? (
    <RescheduleModal
      bookingId={b.id}
      courtId={b.court_id}
      courtLabel={`${b.courts?.name} — ${b.courts?.type}`}
      venueName={venue.name}
      durationMinutes={b.duration_minutes}
      bookingWindowDays={bookingWindowDays}
      hours={weekFor(venueSettings, (b.courts as any)?.venue_slug ?? '')}
      onClose={() => setShowReschedule(false)}
      onRescheduled={() => { setShowReschedule(false); router.refresh() }}
    />
  ) : null

  // An opened booking is a set of tiles: the ticket across the top, then where, what you pay, the friends, sharing,
  // and the two things you can change. (Past bookings keep the plain card below.)
  if (collapsible && expanded) {
    const unpaidShares = splits.filter(s => s.status !== 'paid')
    const paidShares = splits.length - unpaidShares.length
    const tile = 'rounded-[18px] p-3.5 flex flex-col gap-2'
    const tileStyle = { background: 'var(--bg-raised)', border: '1px solid var(--border)' } as const
    const label = { fontSize: 10.5, letterSpacing: '0.1em', color: 'var(--text-subtle)' } as const
    return (
      <div className="rounded-[20px] p-3 sm:p-4" data-testid="booking-open" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
        <button onClick={() => setExpanded(false)} className="flex items-center gap-1.5 text-xs font-semibold mb-2.5 ml-1" style={{ color: 'var(--text-subtle)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6"/></svg>
          Close
        </button>
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2 rounded-[18px] p-4 flex items-center gap-3.5" style={{ background: 'linear-gradient(160deg, #2c5fc4, #1d3f8d)', color: '#ffffff' }}>
            <CourtTile name={b.courts?.name ?? ''} size={66} />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-extrabold uppercase" style={{ letterSpacing: '0.12em', color: '#cfe0ff' }}>
                {isNext && 'Up next · '}{longDate(b.date)}{b.regular_id ? ' · 🔁 Regular' : ''}
              </div>
              <div className="font-black leading-none" style={{ fontSize: 36, letterSpacing: '-0.03em' }}>{fmtClock(b.start_time)}</div>
              <div className="text-[13px] font-bold mt-1" style={{ color: '#cfe0ff' }}>until {fmtClock(b.end_time)} · {durationLabel(b.duration_minutes)} · {b.courts?.name} — {b.courts?.type}</div>
            </div>
          </div>

          <div className={tile} style={tileStyle}>
            <div className="font-extrabold uppercase" style={label}>Where</div>
            <div className="text-[14.5px] font-bold" style={{ color: 'var(--text-primary)' }}>{venue?.name ?? 'The club'}</div>
            {venue && (
              <div className="flex flex-wrap gap-1.5 mt-auto">
                <DirectionsButton address={venue.address} />
                <AddToCalendarButton booking={b} courtLabel={`${b.courts?.name} — ${b.courts?.type}`} venueAddress={venue.address} />
              </div>
            )}
          </div>

          <div className={tile} style={tileStyle}>
            <div className="font-extrabold uppercase" style={label}>{yourShare !== null ? 'Your share' : 'Price'}</div>
            <div className="leading-none" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display), Manrope, sans-serif', fontWeight: 800, fontSize: 28 }}>{formatPrice(yourShare ?? b.price_nzd, bookingCurrency)}</div>
            {yourShare !== null && (
              <div className="text-[10.5px] font-bold" style={{ color: 'var(--brand-primary-text)' }}>Split {shareCount} ways · {formatPrice(b.price_nzd, bookingCurrency)} court</div>
            )}
            <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: b.status === 'confirmed' ? 'var(--brand-primary-text)' : 'var(--text-muted)' }}>{b.status}</div>
            {b.stripe_payment_id ? (
              <a href={`${stripeDashboardBase}/${b.stripe_payment_id}`} target="_blank" rel="noopener noreferrer" className="text-[11px] font-medium" style={{ color: payment.color, textDecoration: 'underline' }}>{payment.label} · Receipt ↗</a>
            ) : (
              <div className="text-[11px] font-medium" style={{ color: payment.color }}>{payment.label}</div>
            )}
            {!past && b.status === 'confirmed' && !b.stripe_payment_id && b.pay_by && (
              <>
                <div className="text-[11px] font-bold" style={{ color: 'var(--brand-yellow)' }}>Pay by {fmtPayBy(b.pay_by, timezoneForVenueSlug((b.courts as any)?.venue_slug))}</div>
                <button onClick={payNow} disabled={paying} className="rounded-full px-3 text-xs font-bold disabled:opacity-50" style={{ minHeight: 36, background: 'var(--brand-primary)', color: 'var(--brand-primary-on)' }}>{paying ? 'Opening…' : 'Pay now'}</button>
              </>
            )}
          </div>

          {splits.length > 0 && (
            <div className={`col-span-2 ${tile}`} style={tileStyle}>
              <div className="flex items-center justify-between gap-2">
                <div className="font-extrabold uppercase" style={label}>Friends</div>
                <div className="text-[11px] font-extrabold uppercase" style={{ letterSpacing: '0.08em', color: unpaidShares.length > 0 ? 'var(--text-muted)' : 'var(--go-text)' }}>
                  {unpaidShares.length > 0 ? `${unpaidShares.length} of ${splits.length} still to pay` : 'All paid'}
                </div>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }} aria-hidden>
                <div className="h-full rounded-full" style={{ width: `${Math.round((paidShares / splits.length) * 100)}%`, background: 'linear-gradient(90deg, #1f9a5f, #34D399)' }} />
              </div>
              {members.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {members.map(sp => {
                    const name = sp.profiles?.nickname ?? sp.profiles?.full_name ?? 'Player'
                    const paid = sp.status === 'paid'
                    return (
                      <span key={sp.id} className="inline-flex items-center gap-1.5">
                        <PlayerChip name={name} paid={paid} />
                        {!paid && (
                          <RemindButton name={name} amount={formatPrice(Math.round(yourShare ?? b.price_nzd), bookingCurrency)} court={b.courts?.name ?? 'the court'} venueName={venue?.name ?? 'the club'} when={`${formatDate(b.date)} at ${fmtClock(b.start_time)}`} />
                        )}
                      </span>
                    )
                  })}
                </div>
              )}
              {sharesOn && b.status === 'confirmed' && <div className="[&>*]:!mt-0"><ShareDeadlineBox booking={b} shares={splits} /></div>}
            </div>
          )}

          {openSeats.length > 0 && (
            <div className={`col-span-2 ${tile}`} style={tileStyle}>
              {openSeats.map((seat, i) => (
                <div key={seat.id} className="flex flex-col gap-2">
                  <div className="font-extrabold uppercase" style={label}>
                    {openSeats.length > 1 ? `Spot ${i + 1} is waiting for a friend` : 'A spot is waiting for a friend'}
                    <span className="normal-case font-medium" style={{ letterSpacing: 0 }}> · send them the link</span>
                  </div>
                  <InviteShare
                    token={seat.invite_token as string}
                    court={b.courts?.name ?? 'the court'}
                    venueName={venue?.name ?? 'the club'}
                    when={`${formatDate(b.date)} at ${fmtClock(b.start_time)}`}
                    amount={formatPrice(bookerShareCents(b.price_nzd, shareCount) / 100, bookingCurrency)}
                  />
                </div>
              ))}
            </div>
          )}

          {(canReschedule || canCancel) && (
            <div className="col-span-2 grid grid-cols-2 gap-2 [&>*:only-child]:col-span-2">
              {canReschedule && (
                <div className="rounded-[18px] p-2.5 flex flex-col items-center gap-0.5" style={{ background: 'var(--bg-raised)', border: '1px solid var(--brand-primary)' }}>
                  <button type="button" onClick={() => setShowReschedule(true)} className="w-full py-2 text-[14px] font-extrabold" style={{ color: 'var(--brand-primary-text)' }}>Reschedule</button>
                  <span className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>No charge</span>
                </div>
              )}
              {canCancel && (
                <div className="rounded-[18px] p-2.5 flex flex-col items-center gap-0.5" style={{ background: 'var(--bg-raised)', border: '1px solid var(--brand-accent)' }}>
                  <button onClick={onCancel} disabled={cancelling} className="w-full py-2 text-[14px] font-extrabold disabled:opacity-60" style={{ color: 'var(--brand-accent)' }}>{cancelling ? '…' : 'Cancel'}</button>
                  <span className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>{!isPaid ? 'No charge' : isLateCancel ? (rule.after === 'half' ? '50% credit' : 'No refund') : 'Full refund'}</span>
                </div>
              )}
            </div>
          )}
        </div>
        {rescheduleModal}
      </div>
    )
  }

  return (
    <div className="rounded-[20px] p-5" style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      boxShadow: isNext ? '0 0 0 1px var(--ring-primary), 0 30px 70px -20px var(--ring-primary)' : 'var(--shadow-float)',
      opacity: muted ? 0.72 : 1,
    }}>
      {isNext && (
        <div className="flex items-center gap-1.5 text-xs font-semibold mb-2.5" style={{ color: 'var(--brand-primary-text)' }}>
          <span style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--brand-primary)' }} />
          Up next
        </div>
      )}
      {collapsible && expanded && (
        <button onClick={() => setExpanded(false)}
          className="flex items-center gap-1.5 text-xs font-semibold mb-2.5"
          style={{ color: 'var(--text-subtle)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6"/></svg>
          Close
        </button>
      )}
      <div className="flex flex-col sm:flex-row sm:items-start gap-2.5">
        <div className="flex items-start gap-3 min-w-0 sm:flex-1">
          <MiniCourt name={b.courts?.name} muted={muted} />
          <div className="min-w-0">
            <div className="text-[10.5px] font-extrabold uppercase" style={{ letterSpacing: '0.08em', color: 'var(--text-muted)' }}>{longDate(b.date)}</div>
            <div className="text-[15px]" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display), Manrope, sans-serif', fontWeight: 500 }}>
              {b.courts?.name} — {b.courts?.type}
              {b.regular_id && <span className="ml-2 align-middle text-[10px] font-extrabold rounded-full px-2 py-0.5" style={{ background: 'var(--brand-primary-muted)', color: 'var(--brand-primary-text)' }}>🔁 Regular</span>}
            </div>
            {venue && (
              <div className={muted ? 'text-xs font-semibold mt-0.5 flex items-center gap-1.5' : 'text-xs font-bold mt-0.5 flex items-center gap-1.5'} style={{ color: muted ? 'var(--text-muted)' : 'var(--brand-primary-text)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                {venue.name}
              </div>
            )}
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {fmtClockRange(b.start_time, b.end_time)} · {durationLabel(b.duration_minutes)}
            </div>
          </div>
        </div>
        <div className="sm:ml-auto text-right shrink-0 flex flex-col items-end gap-1.5">
          <div className="text-[30px] leading-none" style={{ color: muted ? 'var(--text-muted)' : 'var(--text-primary)', fontFamily: 'var(--font-display), Manrope, sans-serif', fontWeight: muted ? 500 : 700 }}>{formatPrice(yourShare ?? b.price_nzd, bookingCurrency)}</div>
          {yourShare !== null && (
            <div className="text-[10px] font-bold rounded-full px-2 py-0.5 whitespace-nowrap"
              style={{ background: 'var(--brand-primary-muted)', color: 'var(--brand-primary-text)', border: '1px solid var(--brand-primary)' }}>
              Split {shareCount} ways · {formatPrice(b.price_nzd, bookingCurrency)} court
            </div>
          )}
          <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: !muted && b.status === 'confirmed' ? 'var(--brand-primary-text)' : 'var(--text-muted)' }}>{b.status}</div>
          {b.stripe_payment_id ? (
            <a href={`${stripeDashboardBase}/${b.stripe_payment_id}`} target="_blank" rel="noopener noreferrer"
              className="text-[10px] font-medium -mt-1" style={{ color: payment.color, textDecoration: 'underline' }}>
              {payment.label} · Receipt ↗
            </a>
          ) : (
            <div className="text-[10px] font-medium -mt-1" style={{ color: payment.color }}>{payment.label}</div>
          )}
          {/* A held week of a regular: say when it must be paid by, and let them pay now. */}
          {!past && b.status === 'confirmed' && !b.stripe_payment_id && b.pay_by && (
            <>
              <div className="text-[10px] font-bold" style={{ color: 'var(--brand-yellow)' }}>Pay by {fmtPayBy(b.pay_by, timezoneForVenueSlug((b.courts as any)?.venue_slug))}</div>
              <button onClick={payNow} disabled={paying} className="rounded-full px-3 text-xs font-bold disabled:opacity-50" style={{ minHeight: 36, background: 'var(--brand-primary)', color: 'var(--brand-primary-on)' }}>
                {paying ? 'Opening…' : 'Pay now'}
              </button>
            </>
          )}
        </div>
      </div>
      {!past && sharesOn && b.status === 'confirmed' && <ShareDeadlineBox booking={b} shares={splits} />}
      {!past && venue && (
        <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2.5" style={{ borderTop: '1px solid var(--border)' }}>
          <DirectionsButton address={venue.address} />
          <AddToCalendarButton booking={b} courtLabel={`${b.courts?.name} — ${b.courts?.type}`} venueAddress={venue.address} />
        </div>
      )}
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2 pt-2.5 mt-2.5" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {splits.length > 0 && (
            <>
              {/* "Has Jonesy paid me back yet" is the real question behind a
                  split booking, and a chip's colour alone was answering it too
                  quietly. Unpaid shares are now counted in words. */}
              <span className="text-xs font-medium" style={{ color: 'var(--text-subtle)' }}>
                {!past && splits.some(s => s.status !== 'paid')
                  ? `${splits.filter(s => s.status !== 'paid').length} of ${splits.length} still to pay`
                  : 'With'}
              </span>
              {members.map(s => {
              const name = s.profiles?.nickname ?? s.profiles?.full_name ?? 'Player'
              const paid = s.status === 'paid'
              return (
                <span key={s.id} className="flex items-center justify-between gap-1.5 sm:inline-flex sm:justify-start">
                  <PlayerChip name={name} paid={paid} />
                  {!paid && !past && (
                    <RemindButton
                      name={name}
                      amount={formatPrice(Math.round(yourShare ?? b.price_nzd), bookingCurrency)}
                      court={b.courts?.name ?? 'the court'}
                      venueName={venue?.name ?? 'the club'}
                      when={`${formatDate(b.date)} at ${fmtClock(b.start_time)}`}
                    />
                  )}
                </span>
              )
            })}
            </>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-start sm:ml-auto [&>*:only-child]:col-span-2 sm:[&>*:only-child]:col-span-1">
          {past && b.status !== 'cancelled' && <RecordResultButton bookingId={b.id} />}
          {past && b.status !== 'cancelled' && <BookAgainButton courtId={b.court_id} durationMinutes={b.duration_minutes} />}
          {past && b.stripe_payment_id && (
            <a href={`${stripeDashboardBase}/${b.stripe_payment_id}`} target="_blank" rel="noopener noreferrer"
              className="btn btn-sm" style={{ background: 'var(--bg-raised)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              Receipt ↗
            </a>
          )}
          {canReschedule && (
            <div className="flex flex-col items-center gap-1 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setShowReschedule(true)}
                className="btn btn-sm w-full sm:w-auto justify-center"
                style={{ background: 'var(--brand-primary-muted)', color: 'var(--brand-primary-text)', border: '1px solid var(--brand-primary)', fontWeight: 600 }}
              >
                Reschedule
              </button>
              <span className="text-xs text-center" style={{ color: 'var(--text-muted)', fontWeight: 600 }}>No charge</span>
            </div>
          )}
          {canCancel && (
            <div className="flex flex-col items-center gap-1 w-full sm:w-auto">
              <button className="btn btn-danger btn-sm w-full sm:w-auto justify-center" onClick={onCancel} disabled={cancelling}>
                {cancelling ? '…' : 'Cancel'}
              </button>
              <span className="text-xs text-center" style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{!isPaid ? 'No charge' : isLateCancel ? (rule.after === 'half' ? '50% credit' : 'No refund') : 'Full refund'}</span>
            </div>
          )}
        </div>
      </div>
      {openSeats.length > 0 && (
        <div className="mt-2.5 pt-2.5 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
          {openSeats.map((seat, i) => (
            <div key={seat.id}>
              <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                {openSeats.length > 1 ? `Spot ${i + 1} is waiting for a friend` : 'A spot is waiting for a friend'}
                <span style={{ color: 'var(--text-subtle)' }}> · send them the link</span>
              </div>
              <InviteShare
                token={seat.invite_token as string}
                court={b.courts?.name ?? 'the court'}
                venueName={venue?.name ?? 'the club'}
                when={`${formatDate(b.date)} at ${fmtClock(b.start_time)}`}
                amount={formatPrice(bookerShareCents(b.price_nzd, shareCount) / 100, bookingCurrency)}
              />
            </div>
          ))}
        </div>
      )}
      {rescheduleModal}
    </div>
  )
}


function JoinedGameRow({ game: j, currentUserId }: { game: JoinedGame; currentUserId?: string }) {
  const b = j.bookings
  if (!b) return null
  const venue = VENUES.find(v => v.slug === b.courts?.venue_slug)
  const organizerName = j.profiles?.nickname ?? j.profiles?.full_name ?? 'Someone'
  const coPlayers = (b.booking_splits ?? []).filter(s => s.user_id && s.user_id !== currentUserId)

  return (
    <div className="rounded-[20px] p-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
      <div className="flex flex-col sm:flex-row sm:items-start gap-2.5">
        <div className="flex items-start gap-3 min-w-0 sm:flex-1">
          <MiniCourt name={b.courts?.name} />
          <div className="min-w-0">
            <div className="text-[10.5px] font-extrabold uppercase" style={{ letterSpacing: '0.08em', color: 'var(--text-muted)' }}>{longDate(b.date)}</div>
            <div className="text-[15px] flex items-center gap-2 flex-wrap" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display), Manrope, sans-serif', fontWeight: 500 }}>
              <span>{b.courts?.name} — {b.courts?.type}</span>
              {/* Marks this row out now that joined games share a list with
                  your own bookings. */}
              <span className="text-[9px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0"
                style={{ background: 'var(--brand-primary-muted)', color: 'var(--brand-primary-text)', border: '1px solid var(--brand-primary)' }}>
                Joined
              </span>
            </div>
            <div className="text-xs font-bold mt-0.5" style={{ color: 'var(--brand-accent)' }}>
              Joining {organizerName}'s game
            </div>
            {venue && (
              <div className="text-xs font-bold mt-0.5 flex items-center gap-1.5" style={{ color: 'var(--brand-primary-text)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                {venue.name}
              </div>
            )}
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {fmtClockRange(b.start_time, b.end_time)} · {durationLabel(b.duration_minutes)}
            </div>
          </div>
        </div>
        <div className="sm:ml-auto text-right shrink-0 flex flex-col items-end gap-1.5">
          <div className="text-lg leading-none" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display), Manrope, sans-serif', fontWeight: 700 }}>{formatPrice(j.amount_nzd, currencyForRegion(venue?.region))}</div>
          <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--brand-primary-text)' }}>Paid ✓</div>
          {venue && (
            <div className="flex flex-wrap gap-1.5 mt-0.5 justify-end">
              <DirectionsButton address={venue.address} />
              <AddToCalendarButton
                booking={{ id: j.id, date: b.date, start_time: b.start_time, end_time: b.end_time }}
                courtLabel={`${b.courts?.name} — ${b.courts?.type}`}
                venueAddress={venue.address}
              />
            </div>
          )}
        </div>
      </div>
      {coPlayers.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-2.5 mt-2.5" style={{ borderTop: '1px solid var(--border)' }}>
          <span className="text-xs font-medium" style={{ color: 'var(--text-subtle)' }}>With</span>
          {coPlayers.map(cp => (
            <PlayerChip key={cp.user_id} name={cp.profiles?.nickname ?? cp.profiles?.full_name ?? 'Player'} paid={cp.status === 'paid'} />
          ))}
        </div>
      )}
    </div>
  )
}

// The page passes each club's cancellation rule; every row and the regular cards read theirs from here.
export default function MyBookingsList(props: Parameters<typeof MyBookingsListInner>[0] & { rules?: Record<string, CancellationRule> }) {
  const { rules = {}, ...rest } = props
  return <RulesCtx.Provider value={rules}><MyBookingsListInner {...rest} /></RulesCtx.Provider>
}
