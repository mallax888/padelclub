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

const DirectionsButton = ({ address }: { address: string }) => (
  <a
    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
    target="_blank"
    rel="noopener noreferrer"
    className="flex-1 flex items-center justify-center gap-2 text-sm font-bold py-3 rounded-xl transition-all"
    style={{ background: 'var(--brand-blue)', color: '#fff', border: '1px solid var(--brand-blue)' }}
    onClick={e => e.stopPropagation()}
  >
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
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
    className="flex-1 flex items-center justify-center gap-2 text-sm font-bold py-3 rounded-xl transition-all"
    style={{ background: 'var(--brand-yellow)', color: '#16181D', border: '1px solid var(--brand-yellow)' }}
    onClick={e => e.stopPropagation()}
  >
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>
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
      if (!data.isPaid) {
        toast.success('Booking cancelled.')
      } else if (data.hoursUntil < 24) {
        toast.success('Booking cancelled. ' + formatNzd(data.creditAmount) + ' credit added to your account.')
      } else {
        toast.success('Booking cancelled. Full refund will appear on your card in 5-10 business days.')
      }
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

      {/* Stat cards — Direction B: gradient surface, bigger numbers, uppercase micro-labels */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Upcoming', value: upcoming.length, color: 'var(--text-primary)' },
          { label: 'Credits', value: '$' + (profile?.credits ?? 0), color: 'var(--brand-primary)' },
          { label: 'Membership', value: mem.name, color: 'var(--text-primary)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-2xl p-4" style={{ background: 'linear-gradient(180deg, var(--bg-surface), var(--bg-raised))', border: '1px solid var(--border)' }}>
            <div className="text-[11px] font-bold mb-1 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</div>
            <div className="text-2xl font-extrabold truncate" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl p-3 mb-5 text-xs" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
        <strong style={{ color: 'var(--text-primary)' }}>Cancellation policy:</strong> Cancel 24hrs+ before = full refund. Cancel under 24hrs = 50% back as account credit.
      </div>

      {/* New booking — Direction B: muted emerald, bordered, normal height */}
      <Link href="/book" className="flex items-center justify-between rounded-2xl p-5 mb-6 transition-all hover:scale-[1.01]"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--brand-primary)', boxShadow: '0 0 0 1px var(--brand-primary-muted) inset' }}>
        <div>
          <div className="text-xl font-black uppercase tracking-wide" style={{ color: 'var(--brand-primary)', lineHeight: 1.1 }}>+ New booking</div>
          <div className="text-sm font-bold mt-1" style={{ color: 'var(--text-muted)' }}>Book a court in seconds</div>
        </div>
        <div style={{ fontSize: 34 }}>🎾</div>
      </Link>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-extrabold" style={{ color: 'var(--text-primary)' }}>Upcoming</h2>
        </div>
        {upcoming.length === 0 ? (
          <div className="rounded-2xl text-center py-8 text-sm" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            No upcoming bookings — <Link href="/book" style={{ color: 'var(--brand-primary)' }}>book a court</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {upcoming.map(b => (
              <BookingRow key={b.id} booking={b} onCancel={() => handleCancel(b.id)} cancelling={cancelling === b.id} splits={outgoingSplits.filter(s => s.booking_id === b.id)} />
            ))}
          </div>
        )}
      </div>

      {upcomingJoined.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-extrabold mb-3" style={{ color: 'var(--text-primary)' }}>Games you've joined</h2>
          <div className="space-y-3">
            {upcomingJoined.map(j => <JoinedGameRow key={j.id} game={j} currentUserId={currentUserId} />)}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <button onClick={() => setShowHistory(!showHistory)} className="flex items-center gap-2 text-sm font-bold mb-3" style={{ color: 'var(--text-muted)' }}>
            <span>{showHistory ? '▼' : '▶'}</span>
            <span>{showHistory ? 'Hide' : 'Show'} history ({past.length})</span>
          </button>
          {showHistory && (
            <div className="space-y-3 opacity-60">
              {past.map(b => <BookingRow key={b.id} booking={b} past splits={outgoingSplits.filter(s => s.booking_id === b.id)} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function BookingRow({ booking: b, onCancel, cancelling, past, splits = [] }: { booking: BookingWithCourt; onCancel?: () => void; cancelling?: boolean; past?: boolean; splits?: OutgoingSplit[] }) {
  const bookingDateTime = new Date(b.date + 'T' + b.start_time)
  const now = new Date()
  const hoursUntil = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60)
  const canCancel = !past && b.status === 'confirmed' && bookingDateTime > now
  const isLateCancel = hoursUntil < 24
  const isPaid = !!b.stripe_payment_id
  const payment = paymentLabel(b.payment_method, b.stripe_payment_id)
  const venue = VENUES.find(v => v.slug === (b.courts as any)?.venue_slug)

  return (
    <div className="rounded-2xl p-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderLeft: '3px solid var(--brand-primary)' }}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0" style={{ background: 'var(--brand-primary-muted)' }}>
            🎾
          </div>
          <div className="min-w-0">
            <div className="font-extrabold text-base" style={{ color: 'var(--text-primary)' }}>
              {b.courts?.name} — {b.courts?.type}
            </div>
            {venue && (
              <div className="text-sm font-bold mt-0.5 flex items-center gap-1.5" style={{ color: 'var(--brand-primary)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                {venue.name}
              </div>
            )}
            <div className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {formatDate(b.date)} · {b.start_time.slice(0,5)}–{b.end_time.slice(0,5)} · {durationLabel(b.duration_minutes)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 sm:block sm:text-right shrink-0">
          <span className="text-xs font-black uppercase tracking-wide px-3 py-1.5 rounded-full" style={{ background: b.status === 'confirmed' ? 'var(--brand-primary-muted)' : 'var(--bg-raised)', color: b.status === 'confirmed' ? 'var(--brand-primary)' : 'var(--text-muted)' }}>{b.status}</span>
          <div className="flex items-baseline gap-2 sm:block">
            <div className="text-2xl font-black sm:mt-2" style={{ color: 'var(--text-primary)' }}>{formatNzd(b.price_nzd)}</div>
            <div className="text-xs font-medium whitespace-nowrap sm:mt-0.5" style={{ color: payment.color }}>{payment.label}</div>
          </div>
        </div>
      </div>
      {!past && venue && (
        <div className="flex gap-2 mt-3">
          <DirectionsButton address={venue.address} />
          <AddToCalendarButton booking={b} courtLabel={`${b.courts?.name} — ${b.courts?.type}`} venueAddress={venue.address} />
        </div>
      )}
      {splits.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 pt-3 mt-3" style={{ borderTop: '1px solid var(--border)' }}>
          <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>Split with:</span>
          {splits.map(s => {
          const name = s.profiles?.nickname ?? s.profiles?.full_name ?? 'Player'
          const paid = s.status === 'paid'
          return (
            <span key={s.id} className="text-xs font-medium px-2 py-0.5 rounded-full" style={{
              background: paid ? 'var(--brand-primary-muted)' : 'var(--brand-crimson-muted)',
              color: paid ? 'var(--brand-primary)' : 'var(--brand-crimson)',
              border: paid ? '1px solid var(--brand-primary)' : '1px solid var(--brand-crimson)',
            }}>
              {name} {paid ? '✓' : '⏳'}
            </span>
          )
        })}
        </div>
      )}
      <div className="flex items-center justify-end pt-2" style={{ borderTop: splits.length > 0 ? 'none' : (past ? 'none' : '1px solid var(--border)') }}>
        <div className="flex items-center gap-2">
          {past && b.status !== 'cancelled' && <BookAgainButton courtId={b.court_id} durationMinutes={b.duration_minutes} />}
          {b.stripe_payment_id && (
            <a href={'https://dashboard.stripe.com/test/payments/' + b.stripe_payment_id} target="_blank" rel="noopener noreferrer"
              className="text-xs px-2 py-1 rounded-lg" style={{ background: 'var(--bg-raised)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              Receipt ↗
            </a>
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
    <div className="rounded-2xl p-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderLeft: '3px solid var(--brand-accent)' }}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-2">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0" style={{ background: 'var(--brand-accent-muted)' }}>
            🙋
          </div>
          <div className="min-w-0">
            <div className="font-extrabold text-base" style={{ color: 'var(--text-primary)' }}>
              {b.courts?.name} — {b.courts?.type}
            </div>
            <div className="text-xs font-bold mt-0.5" style={{ color: 'var(--brand-accent)' }}>
              Joining {organizerName}'s game
            </div>
            {coPlayers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {coPlayers.map(cp => (
                  <span key={cp.user_id} className="text-xs font-medium px-2 py-0.5 rounded-full" style={{
                    background: cp.status === 'paid' ? 'var(--brand-primary-muted)' : 'var(--brand-crimson-muted)',
                    color: cp.status === 'paid' ? 'var(--brand-primary)' : 'var(--brand-crimson)',
                    border: cp.status === 'paid' ? '1px solid var(--brand-primary)' : '1px solid var(--brand-crimson)',
                  }}>
                    {cp.profiles?.nickname ?? cp.profiles?.full_name ?? 'Player'} {cp.status === 'paid' ? '✓' : '⏳'}
                  </span>
                ))}
              </div>
            )}
            {venue && (
              <div className="text-sm font-bold mt-0.5 flex items-center gap-1.5" style={{ color: 'var(--brand-primary)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                {venue.name}
              </div>
            )}
            <div className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {formatDate(b.date)} · {b.start_time.slice(0,5)}–{b.end_time.slice(0,5)} · {durationLabel(b.duration_minutes)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 sm:block sm:text-right shrink-0">
          <div className="text-xs font-black uppercase tracking-wide px-3 py-1.5 rounded-full" style={{ background: 'var(--brand-primary-muted)', color: 'var(--brand-primary)' }}>Paid ✓</div>
          <div className="text-lg font-black sm:mt-2" style={{ color: 'var(--text-primary)' }}>{formatNzd(j.amount_nzd)}</div>
        </div>
      </div>
      {venue && (
        <div className="flex gap-2 mt-3">
          <DirectionsButton address={venue.address} />
          <AddToCalendarButton
            booking={{ id: j.id, date: b.date, start_time: b.start_time, end_time: b.end_time }}
            courtLabel={`${b.courts?.name} — ${b.courts?.type}`}
            venueAddress={venue.address}
          />
        </div>
      )}
    </div>
  )
}
