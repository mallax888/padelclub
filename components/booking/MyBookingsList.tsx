'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { cn, formatNzd, formatDate } from '@/lib/utils'
import { MEMBERSHIP_CONFIG } from '@/types/database'
import type { Profile } from '@/types/database'
import Link from 'next/link'

interface BookingWithCourt {
  id: string
  date: string
  start_time: string
  end_time: string
  status: string
  price_nzd: number
  duration_minutes: number
  payment_method: string
  courts: { name: string; type: string; is_indoor: boolean } | null
}

export default function MyBookingsList({
  bookings,
  profile,
}: {
  bookings: BookingWithCourt[]
  profile: Profile
}) {
  const supabase = createClient()
  const router = useRouter()
  const [cancelling, setCancelling] = useState<string | null>(null)
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
    const policy = hoursUntil >= 24
      ? `Cancel this booking?\n\nSince it is more than 24 hours away you will receive a FULL REFUND to your card within 5-10 business days.`
      : `Cancel this booking?\n\nSince it is less than 24 hours away you will only receive 50% back (${formatNzd(booking.price_nzd * 0.5)}) as account credit.`
    if (!confirm(policy)) return
    setCancelling(id)
    const { error } = await (supabase as any)
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', id)
    if (error) {
      toast.error('Could not cancel — please try again.')
    } else {
      if (hoursUntil < 24) {
        const creditAmount = Math.round(booking.price_nzd * 0.5)
        await (supabase as any)
          .from('profiles')
          .update({ credits: (profile?.credits ?? 0) + creditAmount })
          .eq('id', profile?.id)
        await (supabase as any)
          .from('credit_transactions')
          .insert({
            user_id: profile?.id,
            amount: creditAmount,
            type: 'refund',
            booking_id: id,
            description: `Late cancellation 50% credit — ${booking.courts?.name}`,
          })
        toast.success(`Booking cancelled. ${formatNzd(creditAmount)} credit added to your account.`)
      } else {
        toast.success('Booking cancelled. Full refund will appear on your card in 5-10 business days.')
      }
      router.refresh()
    }
    setCancelling(null)
  }

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Upcoming', value: upcoming.length, color: 'var(--brand-primary)' },
          { label: 'Credits', value: `$${profile?.credits ?? 0}`, color: 'var(--brand-accent)' },
          { label: 'Membership', value: mem.name, color: 'var(--text-primary)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl p-4"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="text-xs mb-1" style={{ color: 'var(--text-subtle)' }}>{label}</div>
            <div className="text-xl font-semibold" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Cancellation policy */}
      <div className="rounded-xl p-3 mb-4 text-xs"
        style={{ background: 'rgba(255, 180, 0, 0.08)', border: '1px solid rgba(255, 180, 0, 0.2)', color: '#F0A500' }}>
        <strong>Cancellation policy:</strong> Cancel 24hrs+ before = full refund to card. Cancel under 24hrs = 50% back as account credit.
      </div>

      {/* Upcoming */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-medium" style={{ color: 'var(--text-primary)' }}>Upcoming</h2>
          <Link href="/book" className="btn btn-primary btn-sm">+ New booking</Link>
        </div>
        {upcoming.length === 0 ? (
          <div className="rounded-xl text-center py-8 text-sm"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            No upcoming bookings —{' '}
            <Link href="/book" style={{ color: 'var(--brand-primary)' }} className="hover:underline">
              book a court
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map(b => (
              <BookingRow
                key={b.id}
                booking={b}
                onCancel={() => handleCancel(b.id)}
                cancelling={cancelling === b.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Past — collapsible */}
      {past.length > 0 && (
        <div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 text-sm mb-3 transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            <span>{showHistory ? '▼' : '▶'}</span>
            <span>{showHistory ? 'Hide' : 'Show'} history ({past.length})</span>
          </button>
          {showHistory && (
            <div className="space-y-2 opacity-60">
              {past.map(b => (
                <BookingRow key={b.id} booking={b} past />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function BookingRow({
  booking: b,
  onCancel,
  cancelling,
  past,
}: {
  booking: BookingWithCourt
  onCancel?: () => void
  cancelling?: boolean
  past?: boolean
}) {
  const bookingDateTime = new Date(`${b.date}T${b.start_time}`)
  const now = new Date()
  const hoursUntil = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60)
  const canCancel = !past && b.status === 'confirmed' && bookingDateTime > now
  const isLateCancel = hoursUntil < 24

  return (
    <div className="flex items-center gap-4 py-3 px-4 rounded-xl"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0"
        style={{ background: 'var(--brand-primary-muted)' }}>
        🎾
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
          {b.courts?.name} — {b.courts?.type}
        </div>
        <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {formatDate(b.date)} · {b.start_time.slice(0,5)}–{b.end_time.slice(0,5)} · {formatNzd(b.price_nzd)}
        </div>
      </div>
      <span className={cn('badge', `status-${b.status}`)}>
        {b.status}
      </span>
      {canCancel && (
        <div className="flex flex-col items-end gap-1 shrink-0">
          <button
            className="btn btn-danger btn-sm"
            onClick={onCancel}
            disabled={cancelling}
          >
            {cancelling ? '…' : 'Cancel'}
          </button>
          <span className="text-[10px]" style={{ color: 'var(--text-subtle)' }}>
            {isLateCancel ? '50% credit' : 'Full refund'}
          </span>
        </div>
      )}
    </div>
  )
}
