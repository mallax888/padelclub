'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { cn, formatDate } from '@/lib/utils'
import { hoursUntilBooking, venueInstant, timezoneForVenueSlug } from '@/lib/timezone'
import { currencyForRegion, formatPrice } from '@/lib/currency'
import { MEMBERSHIP_CONFIG } from '@/types/database'
import type { Profile } from '@/types/database'
import Link from 'next/link'
import { VENUES } from '@/lib/venues'
import { buildBookingIcsDataUri } from '@/lib/ics'
import RescheduleModal from '@/components/booking/RescheduleModal'
import PushRemindersPrompt from '@/components/ui/PushRemindersPrompt'

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
  courts: { name: string; type: string; is_indoor: boolean } | null
}

interface OutgoingSplit {
  id: string
  booking_id: string
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
    booking_splits?: { user_id: string; status: string; profiles: { nickname: string | null; full_name: string | null } | null }[]
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

const DateBlock = ({ dateStr, muted }: { dateStr: string; muted?: boolean }) => {
  const { month, day, weekday } = dateParts(dateStr)
  return (
    <div className="w-12 rounded-xl overflow-hidden text-center shrink-0" style={{ border: '1px solid var(--border)' }}>
      <div className="text-[9px] font-extrabold uppercase tracking-wide py-0.5" style={muted ? { background: 'var(--bg-raised)', color: 'var(--text-muted)' } : { background: 'var(--brand-primary)', color: 'var(--brand-primary-on)' }}>{month}</div>
      <div className="text-lg font-extrabold leading-tight pt-0.5" style={{ background: 'var(--bg-raised)', color: 'var(--text-primary)' }}>{day}</div>
      <div className="text-[9px] font-bold pb-1" style={{ background: 'var(--bg-raised)', color: 'var(--text-muted)' }}>{weekday}</div>
    </div>
  )
}

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
      title: `${courtLabel} — PadelClub`,
      description: 'Padel court booking',
      location: venueAddress,
      date: booking.date,
      startTime: booking.start_time,
      endTime: booking.end_time,
    })}
    download={`padelclub-${booking.date}.ics`}
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
            You last played {court} on {weekday} at {booking.start_time.slice(0, 5)}. Pick a date and we&apos;ll keep the court and the {booking.duration_minutes} minutes.
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

export default function MyBookingsList({
  bookings,
  profile,
  splitRequests = [],
  outgoingSplits = [],
  joinedGames = [],
  currentUserId,
  stripeDashboardBase,
}: {
  bookings: BookingWithCourt[]
  profile: Profile
  splitRequests?: SplitRequest[]
  outgoingSplits?: OutgoingSplit[]
  joinedGames?: JoinedGame[]
  currentUserId?: string
  // Supplied by the server page: whether receipts point at Stripe's test or
  // live dashboard depends on which secret key the deployment holds, and that
  // key must never reach the browser.
  stripeDashboardBase: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Stripe sends the booker back here with ?payment=success. That is the one
  // moment a reminder is obviously worth having, so the permission ask leans
  // on it rather than waiting to be found in the navbar.
  const justPaid = searchParams?.get('payment') === 'success' || searchParams?.get('split') === 'paid'
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [payingSplit, setPayingSplit] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  const mem = MEMBERSHIP_CONFIG[profile?.membership_tier ?? 'casual'] ?? MEMBERSHIP_CONFIG['casual']
  const now = new Date()
  const hasEnded = (date: string, endTime: string) => new Date(`${date}T${endTime}`) <= now
  const upcoming = bookings.filter(b => b.status !== 'cancelled' && !hasEnded(b.date, b.end_time))
  const past = bookings.filter(b => b.status === 'cancelled' || hasEnded(b.date, b.end_time))
  const upcomingJoined = joinedGames.filter(j => j.bookings && !hasEnded(j.bookings.date, j.bookings.end_time))
  const hasUpcoming = upcoming.length > 0 || upcomingJoined.length > 0
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
    const yourShare = Math.round((booking.price_nzd / (bookingSplits.length + 1)) * 100) / 100
    // Everyone else on the booking is refunded in full whatever the notice,
    // so say so -- cancelling is a lot easier to face when you know you
    // aren't leaving your mates out of pocket.
    const othersNote = bookingSplits.some(s => s.status === 'paid')
      ? '\n\nEveryone else on this booking is refunded in full.'
      : ''
    const policy = !isPaid
      ? 'Cancel this booking?\n\nNo payment has been charged yet, so this will simply be cancelled with no charge or credit.' + othersNote
      : hoursUntil >= 24
      ? 'Cancel this booking?\n\nSince it is more than 24 hours away you will receive a FULL REFUND to your card within 5-10 business days.' + othersNote
      : 'Cancel this booking?\n\nSince it is less than 24 hours away you will only receive 50% back (' + formatPrice(yourShare * 0.5, currency) + ') as account credit.' + othersNote
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
        : data.hoursUntil < 24
        ? 'Booking cancelled. ' + formatPrice(data.creditAmount, currency) + ' credit added to your account.' + othersRefunded
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
          <div className="space-y-3">
            {splitRequests.map(s => {
              const who = s.profiles?.nickname ?? s.profiles?.full_name ?? 'Someone'
              const court = s.bookings?.courts?.name ?? 'a court'
              const date = s.bookings?.date ? formatDate(s.bookings.date) : ''
              const time = s.bookings?.start_time?.slice(0,5) ?? ''
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
                  </div>
                  <button
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg shrink-0"
                    style={{ background: 'var(--brand-crimson)', color: '#fff' }}
                    disabled={payingSplit === s.id}
                    onClick={async () => {
                      setPayingSplit(s.id)
                      const court = s.bookings?.courts?.name ?? 'Court'
                      const date = s.bookings?.date ?? ''
                      const time = s.bookings?.start_time?.slice(0,5) ?? ''
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

      {/* Stat row — flat label/value pairs, no icon badges */}
      <div className="flex mb-5 pb-4" style={{ borderBottom: '1px solid var(--border)', gap: 28 }}>
        {[
          { label: 'Upcoming', value: upcoming.length },
          { label: 'Credits', value: '$' + (profile?.credits ?? 0) },
          { label: 'Membership', value: mem.name },
        ].map(({ label, value }) => (
          <div key={label} className="min-w-0">
            <div className="text-[10.5px] font-semibold truncate" style={{ color: 'var(--text-subtle)' }}>{label}</div>
            <div className="text-xl truncate" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display), Manrope, sans-serif', fontWeight: 500 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* The full policy was a permanent four-line paragraph sitting above
          every booking — read once, scrolled past forever after. The line
          that matters stays visible; the rest opens on demand. */}
      <details className="mb-5 text-xs rounded-2xl px-3 py-2.5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
        <summary className="cursor-pointer select-none" style={{ listStyle: 'none' }}>
          Cancel 24hrs+ before for a full refund. <span style={{ color: 'var(--brand-primary-text)', fontWeight: 600 }}>Full policy</span>
        </summary>
        <div className="mt-2 pt-2 leading-relaxed" style={{ borderTop: '1px solid var(--border)' }}>
          Cancel under 24hrs and 50% comes back as account credit. Reschedule to a new date or time any time before the 24hr mark, no charge. Everyone else on a split booking is refunded in full, whatever the notice.
        </div>
      </details>

      {/* New booking — solid lime CTA card */}
      <Link href="/book" className="flex items-center justify-between gap-3 rounded-2xl px-5 py-[21px] mb-5 transition-all hover:scale-[1.01]"
        style={{ background: 'var(--brand-primary)', color: 'var(--brand-primary-on)', boxShadow: 'var(--glow-primary)' }}>
        <div className="min-w-0">
          <div className="text-2xl" style={{ fontFamily: 'var(--font-display), Manrope, sans-serif', fontWeight: 800, letterSpacing: '-0.01em' }}>+ New booking</div>
          <div className="text-[13px] mt-0.5" style={{ fontWeight: 600, opacity: 0.75 }}>Book a court in seconds</div>
        </div>
        <div className="shrink-0" style={{ fontSize: '1.7rem' }}>🎾</div>
      </Link>

      {/* Only worth asking once there's actually something to be reminded
          about -- a court in the diary, or a share someone has just paid. */}
      {hasUpcoming && <PushRemindersPrompt highlight={justPaid} />}

      {/* One tab bar that actually switches. "Upcoming" used to appear twice
          on this screen: as the heading of a list that never hid, and again
          on a pill below it that only revealed past bookings — so tapping
          "Upcoming" did nothing visible. */}
      <div className="inline-flex gap-1 p-1 rounded-full mb-3" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
        <button onClick={() => setShowHistory(false)} className="text-xs font-bold px-3.5 py-1.5 rounded-full transition-colors"
          style={showHistory ? { color: 'var(--text-subtle)' } : { background: 'var(--bg-surface)', color: 'var(--text-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }}>
          Upcoming ({upcoming.length + upcomingJoined.length})
        </button>
        <button onClick={() => setShowHistory(true)} className="text-xs font-bold px-3.5 py-1.5 rounded-full transition-colors"
          style={showHistory ? { background: 'var(--bg-surface)', color: 'var(--text-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' } : { color: 'var(--text-subtle)' }}>
          Past ({past.length})
        </button>
      </div>

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
          <div className="space-y-2">
            {upcoming.map((b, i) => (
              <BookingRow key={b.id} booking={b} isNext={i === 0} collapsible={i > 0} onCancel={() => handleCancel(b.id)} cancelling={cancelling === b.id} splits={outgoingSplits.filter(s => s.booking_id === b.id)} bookingWindowDays={mem.bookingWindowDays} stripeDashboardBase={stripeDashboardBase} />
            ))}
            {upcomingJoined.map(j => <JoinedGameRow key={j.id} game={j} currentUserId={currentUserId} />)}
          </div>
        )
      )}

      {showHistory && (
        past.length === 0 ? (
          <div className="rounded-2xl text-center py-8 text-sm" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            Nothing here yet.
          </div>
        ) : (
          <div className="space-y-2 opacity-60">
            {past.map(b => <BookingRow key={b.id} booking={b} past splits={outgoingSplits.filter(s => s.booking_id === b.id)} stripeDashboardBase={stripeDashboardBase} />)}
          </div>
        )
      )}
    </div>
  )
}

function BookingRow({ booking: b, onCancel, cancelling, past, isNext, collapsible, splits = [], bookingWindowDays = 14, stripeDashboardBase }: { booking: BookingWithCourt; onCancel?: () => void; cancelling?: boolean; past?: boolean; isNext?: boolean; collapsible?: boolean; splits?: OutgoingSplit[]; bookingWindowDays?: number; stripeDashboardBase: string }) {
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
  const canReschedule = canCancel && hoursUntil >= 24
  const isLateCancel = hoursUntil < 24
  const isPaid = !!b.stripe_payment_id
  const payment = paymentLabel(b.payment_method, b.stripe_payment_id)
  const venue = VENUES.find(v => v.slug === (b.courts as any)?.venue_slug)
  const [showReschedule, setShowReschedule] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const muted = !isNext && !past

  // price_nzd is the whole court fee, but a booking with splits only ever
  // charged the booker their own share of it -- see create-checkout, which
  // divides by the split rows + 1 for the booker. Showing the court fee with
  // "Paid" under it read as "you paid $120" when $30 left the account.
  //
  // Rounded in cents the same way create-checkout works out the charge, so
  // this figure always matches the Stripe receipt the link goes to.
  const shareCount = splits.length + 1
  const yourShare = splits.length > 0
    ? Math.round((b.price_nzd / shareCount) * 100) / 100
    : null
  const bookingCurrency = currencyForRegion(venue?.region)

  // Every upcoming booking used to be a full card with Directions, Add to
  // calendar, Reschedule and Cancel on it, so three bookings filled the
  // screen with four copies of the same four buttons. The next game stays
  // open, because that is the one people come here to check; the rest are a
  // line each until you ask for more.
  if (collapsible && !expanded) {
    const unpaidCount = splits.filter(s => s.status !== 'paid').length
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full flex items-center gap-3 rounded-2xl px-3.5 py-3 text-left transition-colors"
        style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
        <span className="text-xs font-bold shrink-0" style={{ color: 'var(--text-primary)', width: 52, fontVariantNumeric: 'tabular-nums' }}>
          {dateParts(b.date).weekday} {dateParts(b.date).day}
        </span>
        <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)', width: 42, fontVariantNumeric: 'tabular-nums' }}>
          {b.start_time.slice(0, 5)}
        </span>
        <span className="text-xs truncate min-w-0 flex-1" style={{ color: 'var(--text-primary)' }}>
          {b.courts?.name}{venue ? ` — ${venue.name.split(' ').slice(-2).join(' ')}` : ''}
        </span>
        {splits.length > 0 && (
          <span className="flex shrink-0 items-center">
            {splits.slice(0, 4).map((s, i) => {
              const name = s.profiles?.nickname ?? s.profiles?.full_name ?? 'Player'
              return (
                <span key={s.id}
                  title={`${name} — ${s.status === 'paid' ? 'paid' : 'not paid yet'}`}
                  className="inline-flex items-center justify-center rounded-full text-[9px] font-bold"
                  style={{
                    width: 18, height: 18, marginLeft: i === 0 ? 0 : -5,
                    background: avatarColor(name), color: '#fff',
                    border: `1.5px solid ${s.status === 'paid' ? 'var(--brand-primary)' : 'var(--brand-yellow)'}`,
                  }}>
                  {getInitial(name)}
                </span>
              )
            })}
          </span>
        )}
        {/* The one thing worth saying out loud on a closed row: somebody still
            owes you for this court. */}
        {unpaidCount > 0 && (
          <span className="text-[10px] font-bold shrink-0 px-2 py-0.5 rounded-full whitespace-nowrap"
            style={{ background: 'var(--brand-yellow-muted)', color: 'var(--brand-yellow)' }}>
            {unpaidCount} to pay
          </span>
        )}
        <span className="text-xs font-bold shrink-0 text-right" style={{ color: 'var(--text-primary)', width: 56, fontFamily: 'var(--font-display), Manrope, sans-serif' }}>
          {formatPrice(Math.round(yourShare ?? b.price_nzd), bookingCurrency)}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-subtle)', flexShrink: 0 }}><path d="M6 9l6 6 6-6"/></svg>
      </button>
    )
  }

  return (
    <div className="rounded-2xl p-3.5" style={{
      background: isNext ? 'var(--bg-surface)' : 'var(--bg-raised)',
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
          <DateBlock dateStr={b.date} muted={muted} />
          <div className="min-w-0">
            <div className="text-[15px]" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display), Manrope, sans-serif', fontWeight: 500 }}>
              {b.courts?.name} — {b.courts?.type}
            </div>
            {venue && (
              <div className={muted ? 'text-xs font-semibold mt-0.5 flex items-center gap-1.5' : 'text-xs font-bold mt-0.5 flex items-center gap-1.5'} style={{ color: muted ? 'var(--text-muted)' : 'var(--brand-primary-text)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                {venue.name}
              </div>
            )}
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {b.start_time.slice(0,5)}–{b.end_time.slice(0,5)} · {durationLabel(b.duration_minutes)}
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
        </div>
      </div>
      {!past && venue && (
        <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2.5" style={{ borderTop: '1px solid var(--border)' }}>
          <DirectionsButton address={venue.address} />
          <AddToCalendarButton booking={b} courtLabel={`${b.courts?.name} — ${b.courts?.type}`} venueAddress={venue.address} />
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 mt-2.5" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="flex flex-wrap items-center gap-2">
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
              {splits.map(s => {
              const name = s.profiles?.nickname ?? s.profiles?.full_name ?? 'Player'
              const paid = s.status === 'paid'
              return (
                <span key={s.id} className="inline-flex items-center gap-1.5">
                  <PlayerChip name={name} paid={paid} />
                  {!paid && !past && (
                    <RemindButton
                      name={name}
                      amount={formatPrice(Math.round(yourShare ?? b.price_nzd), bookingCurrency)}
                      court={b.courts?.name ?? 'the court'}
                      venueName={venue?.name ?? 'the club'}
                      when={`${formatDate(b.date)} at ${b.start_time.slice(0, 5)}`}
                    />
                  )}
                </span>
              )
            })}
            </>
          )}
        </div>
        <div className="flex items-start gap-2 ml-auto">
          {past && b.status !== 'cancelled' && <RecordResultButton bookingId={b.id} />}
          {past && b.status !== 'cancelled' && <BookAgainButton courtId={b.court_id} durationMinutes={b.duration_minutes} />}
          {past && b.stripe_payment_id && (
            <a href={`${stripeDashboardBase}/${b.stripe_payment_id}`} target="_blank" rel="noopener noreferrer"
              className="btn btn-sm" style={{ background: 'var(--bg-raised)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              Receipt ↗
            </a>
          )}
          {canReschedule && (
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => setShowReschedule(true)}
                className="btn btn-sm"
                style={{ background: 'var(--brand-primary-muted)', color: 'var(--brand-primary-text)', border: '1px solid var(--brand-primary)', fontWeight: 600 }}
              >
                Reschedule
              </button>
              <span className="text-xs text-center" style={{ color: 'var(--text-muted)', fontWeight: 600 }}>No charge</span>
            </div>
          )}
          {canCancel && (
            <div className="flex flex-col items-center gap-1">
              <button className="btn btn-danger btn-sm" onClick={onCancel} disabled={cancelling}>
                {cancelling ? '…' : 'Cancel'}
              </button>
              <span className="text-xs text-center" style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{!isPaid ? 'No charge' : isLateCancel ? '50% credit' : 'Full refund'}</span>
            </div>
          )}
        </div>
      </div>
      {showReschedule && venue && (
        <RescheduleModal
          bookingId={b.id}
          courtId={b.court_id}
          courtLabel={`${b.courts?.name} — ${b.courts?.type}`}
          venueName={venue.name}
          durationMinutes={b.duration_minutes}
          bookingWindowDays={bookingWindowDays}
          onClose={() => setShowReschedule(false)}
          onRescheduled={() => { setShowReschedule(false); router.refresh() }}
        />
      )}
    </div>
  )
}


function JoinedGameRow({ game: j, currentUserId }: { game: JoinedGame; currentUserId?: string }) {
  const b = j.bookings
  if (!b) return null
  const venue = VENUES.find(v => v.slug === b.courts?.venue_slug)
  const organizerName = j.profiles?.nickname ?? j.profiles?.full_name ?? 'Someone'
  const coPlayers = (b.booking_splits ?? []).filter(s => s.user_id !== currentUserId)

  return (
    <div className="rounded-2xl p-3.5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
      <div className="flex flex-col sm:flex-row sm:items-start gap-2.5">
        <div className="flex items-start gap-3 min-w-0 sm:flex-1">
          <DateBlock dateStr={b.date} />
          <div className="min-w-0">
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
              {b.start_time.slice(0,5)}–{b.end_time.slice(0,5)} · {durationLabel(b.duration_minutes)}
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
