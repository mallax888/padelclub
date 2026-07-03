'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { cn, formatNzd, formatDate } from '@/lib/utils'
import { MEMBERSHIP_CONFIG } from '@/types/database'
import type { Profile } from '@/types/database'
import Link from 'next/link'
import { VENUES } from '@/lib/venues'

interface BookingWithCourt {
  id: string
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
    courts: { name: string; type: string } | null
  } | null
  profiles: { nickname: string | null; full_name: string | null } | null
}

function paymentLabel(method: string, stripeId: string | null) {
  if (method === 'card' && stripeId) return { label: 'Paid', color: '#22c55e' }
  if (method === 'card' && !stripeId) return { label: 'Payment pending', color: '#f59e0b' }
  if (method === 'credits') return { label: 'Paid with credits', color: '#22c55e' }
  if (method === 'membership_allowance') return { label: 'Membership', color: '#22c55e' }
  if (method === 'staff_block') return { label: 'Staff block', color: '#71717A' }
  return { label: method, color: '#71717A' }
}

function durationLabel(mins: number) {
  if (mins === 30) return '30 min'
  if (mins === 60) return '60 min'
  if (mins === 90) return '90 min'
  if (mins === 120) return '120 min'
  return mins + ' min'
}

export default function MyBookingsList({
  bookings,
  profile,
  splitRequests = [],
  outgoingSplits = [],
}: {
  bookings: BookingWithCourt[]
  profile: Profile
  splitRequests?: SplitRequest[]
  outgoingSplits?: OutgoingSplit[]
}) {
  const supabase = createClient()
  const router = useRouter()
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [payingSplit, setPayingSplit] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  const mem = MEMBERSHIP_CONFIG[profile?.membership_tier ?? 'casual'] ?? MEMBERSHIP_CONFIG['casual']
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = bookings.filter(b => b.date >= today && b.status !== 'cancelled')
  const past = bookings.filter(b => b.date < today || b.status === 'cancelled')

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
    const { error } = await (supabase as any).from('bookings').update({ status: 'cancelled' }).eq('id', id)
    if (error) {
      toast.error('Could not cancel — please try again.')
    } else {
      if (!isPaid) {
        toast.success('Booking cancelled.')
      } else if (hoursUntil < 24) {
        const creditAmount = Math.round(booking.price_nzd * 0.5)
        await (supabase as any).from('profiles').update({ credits: (profile?.credits ?? 0) + creditAmount }).eq('id', profile?.id)
        toast.success('Booking cancelled. ' + formatNzd(creditAmount) + ' credit added to your account.')
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
        <div className="rounded-xl p-4 mb-6" style={{ background: 'rgba(220,50,50,0.06)', border: '1px solid #DC3232' }}>
          <div className="text-sm font-semibold mb-3" style={{ color: '#DC3232' }}>Outstanding split requests</div>
          <div className="space-y-3">
            {splitRequests.map(s => {
              const who = s.profiles?.nickname ?? s.profiles?.full_name ?? 'Someone'
              const court = s.bookings?.courts?.name ?? 'a court'
              const date = s.bookings?.date ? formatDate(s.bookings.date) : ''
              const time = s.bookings?.start_time?.slice(0,5) ?? ''
              return (
                <div key={s.id} className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium" style={{ color: '#DC3232' }}>You owe {who} {formatNzd(s.amount_nzd)}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{court} · {date} · {time}</div>
                  </div>
                  <button
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg shrink-0"
                    style={{ background: '#DC3232', color: '#fff' }}
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
                        body: JSON.stringify({ splitId: s.id, amount: s.amount_nzd, courtName: court, date, time, invitedByName }),
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

      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Upcoming', value: upcoming.length, color: 'var(--brand-primary)' },
          { label: 'Credits', value: '$' + (profile?.credits ?? 0), color: 'var(--brand-accent)' },
          { label: 'Membership', value: mem.name, color: 'var(--text-primary)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="text-xs mb-1" style={{ color: 'var(--text-subtle)' }}>{label}</div>
            <div className="text-lg font-semibold truncate" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl p-3 mb-5 text-xs" style={{ background: 'rgba(255,180,0,0.08)', border: '1px solid rgba(255,180,0,0.2)', color: '#F0A500' }}>
        <strong>Cancellation policy:</strong> Cancel 24hrs+ before = full refund. Cancel under 24hrs = 50% back as account credit.
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-medium" style={{ color: 'var(--text-primary)' }}>Upcoming</h2>
          <Link href="/book" className="btn btn-primary btn-sm">+ New booking</Link>
        </div>
        {upcoming.length === 0 ? (
          <div className="rounded-xl text-center py-8 text-sm" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            No upcoming bookings — <Link href="/book" style={{ color: 'var(--brand-primary)' }}>book a court</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map(b => (
              <BookingRow key={b.id} booking={b} onCancel={() => handleCancel(b.id)} cancelling={cancelling === b.id} splits={outgoingSplits.filter(s => s.booking_id === b.id)} />
            ))}
          </div>
        )}
      </div>

      {past.length > 0 && (
        <div>
          <button onClick={() => setShowHistory(!showHistory)} className="flex items-center gap-2 text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
            <span>{showHistory ? '▼' : '▶'}</span>
            <span>{showHistory ? 'Hide' : 'Show'} history ({past.length})</span>
          </button>
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
    <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0" style={{ background: 'var(--brand-primary-muted)' }}>
            🎾
          </div>
          <div className="min-w-0">
            <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
              {b.courts?.name} — {b.courts?.type}
            </div>
            {venue && (
              <div className="text-xs font-semibold mt-0.5" style={{ color: 'var(--brand-primary)' }}>
                📍 {venue.name}
              </div>
            )}
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {formatDate(b.date)} · {b.start_time.slice(0,5)}–{b.end_time.slice(0,5)} · {durationLabel(b.duration_minutes)}
            </div>
            {!past && venue && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium mt-1"
                style={{ color: 'var(--brand-primary)' }}
                onClick={e => e.stopPropagation()}
              >
                Get directions ↗
              </a>
            )}
          </div>
        </div>
        <span className={cn('badge', 'status-' + b.status)} style={{ flexShrink: 0, fontWeight: 700, padding: '4px 12px' }}>{b.status}</span>
      </div>
      {splits.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
          <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>Split with:</span>
          {splits.map(s => {
          const name = s.profiles?.nickname ?? s.profiles?.full_name ?? 'Player'
          const paid = s.status === 'paid'
          return (
            <span key={s.id} className="text-xs font-medium px-2 py-0.5 rounded-full" style={{
              background: paid ? 'var(--brand-primary-muted)' : 'rgba(220,50,50,0.1)',
              color: paid ? 'var(--brand-primary)' : '#DC3232',
              border: paid ? '1px solid var(--brand-primary)' : '1px solid #DC3232',
            }}>
              {name} {paid ? '✓' : '⏳'}
            </span>
          )
        })}
        </div>
      )}
      <div className="flex items-center justify-between pt-2" style={{ borderTop: splits.length > 0 ? 'none' : '1px solid var(--border)' }}>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium" style={{ color: payment.color }}>{payment.label}</span>
          <span className="text-sm font-bold" style={{ color: 'var(--brand-primary)' }}>{formatNzd(b.price_nzd)}</span>
        </div>
        <div className="flex items-center gap-2">
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
