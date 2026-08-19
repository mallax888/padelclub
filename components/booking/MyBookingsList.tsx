'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { cn, formatNzd, formatDate, localDateStr } from '@/lib/utils'
import { MEMBERSHIP_CONFIG } from '@/types/database'
import type { Profile } from '@/types/database'
import Link from 'next/link'
import { VENUES } from '@/lib/venues'
import { buildBookingIcsDataUri } from '@/lib/ics'
import RescheduleModal from '@/components/booking/RescheduleModal'

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
    style={{ background: 'var(--bg-raised)', border: `1px solid ${paid ? 'var(--brand-primary)' : 'var(--border)'}`, color: paid ? 'var(--brand-primary)' : 'var(--text-primary)' }}>
    <span className="inline-flex items-center justify-center rounded-full text-[9px] font-bold shrink-0" style={{ width: 18, height: 18, background: avatarColor(name), color: '#fff' }}>
      {getInitial(name)}
    </span>
    {name.split(' ')[0]}{paid ? ' ✓' : ''}
    {!paid && <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--brand-yellow)', flexShrink: 0 }} />}
  </span>
)

function paymentLabel(method: string, stripeId: string | null) {
  if (method === 'card' && stripeId) return { label: 'Paid', color: 'var(--brand-primary)' }
  if (method === 'card' && !stripeId) return { label: 'Payment pending', color: 'var(--text-muted)' }
  if (method === 'credits') return { label: 'Paid with credits', color: 'var(--brand-primary)' }
  if (method === 'membership_allowance') return { label: 'Membership', color: 'var(--brand-primary)' }
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

const DateBlock = ({ dateStr }: { dateStr: string }) => {
  const { month, day, weekday } = dateParts(dateStr)
  return (
    <div className="w-12 rounded-xl overflow-hidden text-center shrink-0" style={{ border: '1px solid var(--border)' }}>
      <div className="text-[9px] font-extrabold uppercase tracking-wide py-0.5" style={{ background: 'var(--brand-primary)', color: 'var(--brand-primary-on)' }}>{month}</div>
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
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-subtle)' }}><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
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
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-subtle)' }}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>
    Add to calendar
  </a>
)

const BookAgainButton = ({ courtId, durationMinutes }: { courtId: string; durationMinutes: number }) => (
  <Link
    href={`/book?courtId=${courtId}&duration=${durationMinutes}`}
    className="text-xs font-semibold px-2.5 py-1.5 rounded-lg"
    style={{ background: 'var(--brand-primary-muted)', color: 'var(--brand-primary)', border: '1px solid var(--brand-primary)' }}
  >
    Book again
  </Link>
)

export default function MyBookingsList({
  bookings,
  profile,
  splitRequests = [],
  outgoingSplits = [],
  joinedGames = [],
  currentUserId,
}: {
  bookings: BookingWithCourt[]
  profile: Profile
  splitRequests?: SplitRequest[]
  outgoingSplits?: OutgoingSplit[]
  joinedGames?: JoinedGame[]
  currentUserId?: string
}) {
  const router = useRouter()
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [payingSplit, setPayingSplit] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  const mem = MEMBERSHIP_CONFIG[profile?.membership_tier ?? 'casual'] ?? MEMBERSHIP_CONFIG['casual']
  const today = localDateStr()
  const upcoming = bookings.filter(b => b.date >= today && b.status !== 'cancelled')
  const past = bookings.filter(b => b.date < today || b.status === 'cancelled')
  const upcomingJoined = joinedGames.filter(j => (j.bookings?.date ?? '') >= today)

  const handleCancel = async (id: string) => {
    const booking = bookings.find(b => b.id === id)
    if (!booking) return
    const bookingDateTime = new Date(`${booking.date}T${booking.start_time}`)
    const now = new Date()
    const hoursUntil = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60)
    const isPaid = !!(booking as any).stripe_payment_id
    const policy = !isPaid
      ? 'Cancel this booking?\n\nNo payment has been charged yet, so this will simply be cancelled with no charge or credit.'
      : hoursUntil >= 24
      ? 'Cancel this booking?\n\nSince it is more than 24 hours away you will receive a FULL REFUND to your card within 5-10 business days.'
      : 'Cancel this booking?\n\nSince it is less than 24 hours away you will only receive 50% back (' + formatNzd(booking.price_nzd * 0.5) + ') as account credit.'
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
      const receiptUrl = isPaid ? 'https://dashboard.stripe.com/test/payments/' + (booking as any).stripe_payment_id : null
      const message = !data.isPaid
        ? 'Booking cancelled.'
        : data.hoursUntil < 24
        ? 'Booking cancelled. ' + formatNzd(data.creditAmount) + ' credit added to your account.'
        : 'Booking cancelled. Full refund will appear on your card in 5-10 business days.'
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
              return (
                <div key={s.id} className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium" style={{ color: 'var(--brand-crimson)' }}>You owe {who} {formatNzd(s.amount_nzd)}</div>
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
                    {payingSplit === s.id ? 'Loading...' : `Pay ${formatNzd(s.amount_nzd)}`}
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

      <div className="rounded-2xl p-3 mb-5 text-xs" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)', boxShadow: 'var(--shadow-float)' }}>
        <strong style={{ color: 'var(--text-primary)' }}>Cancellation policy:</strong> Cancel 24hrs+ before = full refund. Cancel under 24hrs = 50% back as account credit. Reschedule to a new date/time any time before the 24hr mark, no charge.
      </div>

      {/* New booking — Direction B: muted emerald, bordered, normal height */}
      <Link href="/book" className="flex items-center justify-between rounded-2xl p-3.5 mb-5 transition-all hover:scale-[1.01]"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--brand-primary)', boxShadow: '0 0 0 1px var(--brand-primary-muted) inset' }}>
        <div>
          <div className="text-base font-black uppercase tracking-wide" style={{ color: 'var(--brand-primary)', lineHeight: 1.1 }}>+ New booking</div>
          <div className="text-xs font-bold mt-0.5" style={{ color: 'var(--text-muted)' }}>Book a court in seconds</div>
        </div>
        <div style={{ fontSize: 24 }}>🎾</div>
      </Link>

      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-extrabold" style={{ color: 'var(--text-primary)' }}>Upcoming</h2>
        </div>
        {upcoming.length === 0 ? (
          <div className="rounded-2xl text-center py-8 text-sm" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            No upcoming bookings — <Link href="/book" style={{ color: 'var(--brand-primary)' }}>book a court</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map((b, i) => (
              <BookingRow key={b.id} booking={b} isNext={i === 0} onCancel={() => handleCancel(b.id)} cancelling={cancelling === b.id} splits={outgoingSplits.filter(s => s.booking_id === b.id)} bookingWindowDays={mem.bookingWindowDays} />
            ))}
          </div>
        )}
      </div>

      {upcomingJoined.length > 0 && (
        <div className="mb-5">
          <h2 className="text-base font-extrabold mb-2" style={{ color: 'var(--text-primary)' }}>Games you've joined</h2>
          <div className="space-y-2">
            {upcomingJoined.map(j => <JoinedGameRow key={j.id} game={j} currentUserId={currentUserId} />)}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <div className="inline-flex gap-1 p-1 rounded-full mb-2" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
            <button onClick={() => setShowHistory(false)} className="text-xs font-bold px-3.5 py-1.5 rounded-full transition-colors"
              style={showHistory ? { color: 'var(--text-subtle)' } : { background: 'var(--bg-surface)', color: 'var(--text-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }}>
              Upcoming
            </button>
            <button onClick={() => setShowHistory(true)} className="text-xs font-bold px-3.5 py-1.5 rounded-full transition-colors"
              style={showHistory ? { background: 'var(--bg-surface)', color: 'var(--text-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' } : { color: 'var(--text-subtle)' }}>
              Past ({past.length})
            </button>
          </div>
          {showHistory && (
            <div className="space-y-2 opacity-60">
              {past.map(b => <BookingRow key={b.id} booking={b} past splits={outgoingSplits.filter(s => s.booking_id === b.id)} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function BookingRow({ booking: b, onCancel, cancelling, past, isNext, splits = [], bookingWindowDays = 14 }: { booking: BookingWithCourt; onCancel?: () => void; cancelling?: boolean; past?: boolean; isNext?: boolean; splits?: OutgoingSplit[]; bookingWindowDays?: number }) {
  const router = useRouter()
  const bookingDateTime = new Date(b.date + 'T' + b.start_time)
  const now = new Date()
  const hoursUntil = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60)
  const canCancel = !past && b.status === 'confirmed' && bookingDateTime > now
  const canReschedule = canCancel && hoursUntil >= 24
  const isLateCancel = hoursUntil < 24
  const isPaid = !!b.stripe_payment_id
  const payment = paymentLabel(b.payment_method, b.stripe_payment_id)
  const venue = VENUES.find(v => v.slug === (b.courts as any)?.venue_slug)
  const [showReschedule, setShowReschedule] = useState(false)

  return (
    <div className="rounded-2xl p-3.5" style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      boxShadow: isNext ? '0 0 0 1px var(--ring-primary), 0 30px 70px -20px var(--ring-primary)' : 'var(--shadow-float)',
    }}>
      {isNext && (
        <div className="flex items-center gap-1.5 text-xs font-semibold mb-2.5" style={{ color: 'var(--brand-primary)' }}>
          <span style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--brand-primary)' }} />
          Up next
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-start gap-2.5">
        <div className="flex items-start gap-3 min-w-0 sm:flex-1">
          <DateBlock dateStr={b.date} />
          <div className="min-w-0">
            <div className="text-[15px]" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display), Manrope, sans-serif', fontWeight: 500 }}>
              {b.courts?.name} — {b.courts?.type}
            </div>
            {venue && (
              <div className="text-xs font-bold mt-0.5 flex items-center gap-1.5" style={{ color: 'var(--brand-primary)' }}>
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
          <div className="text-lg leading-none" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display), Manrope, sans-serif', fontWeight: 500 }}>{formatNzd(b.price_nzd)}</div>
          <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: b.status === 'confirmed' ? 'var(--brand-primary)' : 'var(--text-muted)' }}>{b.status}</div>
          {b.stripe_payment_id ? (
            <a href={'https://dashboard.stripe.com/test/payments/' + b.stripe_payment_id} target="_blank" rel="noopener noreferrer"
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
              <span className="text-xs font-medium" style={{ color: 'var(--text-subtle)' }}>With</span>
              {splits.map(s => {
              const name = s.profiles?.nickname ?? s.profiles?.full_name ?? 'Player'
              const paid = s.status === 'paid'
              return <PlayerChip key={s.id} name={name} paid={paid} />
            })}
            </>
          )}
        </div>
        <div className="flex items-start gap-2 ml-auto">
          {past && b.status !== 'cancelled' && <BookAgainButton courtId={b.court_id} durationMinutes={b.duration_minutes} />}
          {past && b.stripe_payment_id && (
            <a href={'https://dashboard.stripe.com/test/payments/' + b.stripe_payment_id} target="_blank" rel="noopener noreferrer"
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
                style={{ background: 'var(--brand-primary-muted)', color: 'var(--brand-primary)', border: '1px solid var(--brand-primary)', fontWeight: 600 }}
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
            <div className="text-[15px]" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display), Manrope, sans-serif', fontWeight: 500 }}>
              {b.courts?.name} — {b.courts?.type}
            </div>
            <div className="text-xs font-bold mt-0.5" style={{ color: 'var(--brand-accent)' }}>
              Joining {organizerName}'s game
            </div>
            {venue && (
              <div className="text-xs font-bold mt-0.5 flex items-center gap-1.5" style={{ color: 'var(--brand-primary)' }}>
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
          <div className="text-lg leading-none" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display), Manrope, sans-serif', fontWeight: 500 }}>{formatNzd(j.amount_nzd)}</div>
          <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--brand-primary)' }}>Paid ✓</div>
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
