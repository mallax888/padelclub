'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { cn, formatNzd, formatDate } from '@/lib/utils'
import { MEMBERSHIP_CONFIG } from '@/types/database'
import type { Profile } from '@/types/database'
import Link from 'next/link'
import { Plus, Navigation, Info } from 'lucide-react'

interface BookingWithCourt {
  id: string
  date: string
  start_time: string
  end_time: string
  status: string
  price_nzd: number
  payment_method: string
  courts: { name: string; type: string; is_indoor: boolean } | null
}

function minutesBetween(start: string, end: string) {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return (eh * 60 + em) - (sh * 60 + sm)
}

function hoursUntil(date: string, start: string) {
  const dt = new Date(`${date}T${start}`)
  return (dt.getTime() - Date.now()) / 36e5
}

export default function MyBookingsList({
  bookings,
  profile,
}: {
  bookings: BookingWithCourt[]
  profile: Profile
}) {
  const supabase: any = createClient()
  const router = useRouter()
  const [cancelling, setCancelling] = useState<string | null>(null)

  const mem = MEMBERSHIP_CONFIG[profile.membership_tier]
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = bookings.filter(b => b.date >= today && b.status !== 'cancelled')
  const past = bookings.filter(b => b.date < today || b.status === 'cancelled')

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this booking?')) return
    setCancelling(id)
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', id)

    if (error) {
      toast.error('Could not cancel — please try again.')
    } else {
      toast.success('Booking cancelled.')
      router.refresh()
    }
    setCancelling(null)
  }

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2.5 mb-4">
        <StatCard label="Upcoming" value={String(upcoming.length)} />
        <StatCard label="Credits" value={`$${profile.credits}`} accent />
        <StatCard label="Membership" value={mem.name} small />
      </div>

      {/* Cancellation policy */}
      <div className="flex items-center gap-2 rounded-[10px] border border-amber-400/20 bg-amber-400/[0.07] px-3.5 py-2.5 mb-5">
        <Info className="h-4 w-4 shrink-0 text-amber-400" />
        <p className="text-xs text-slate-300">
          <span className="font-medium text-amber-400">Cancellation policy</span> — cancel 24hrs+ before for a full refund. Under 24hrs = 50% back as account credit.
        </p>
      </div>

      {/* New booking — primary CTA */}
      <Link
        href="/book"
        className="mb-6 flex w-full items-center justify-center gap-2.5 rounded-xl bg-emerald-500 px-4 py-[18px] text-[17px] font-medium tracking-[0.2px] text-emerald-950 shadow-[0_1px_0_rgba(255,255,255,0.12)_inset] transition-colors hover:bg-emerald-400"
      >
        <Plus className="h-5 w-5" strokeWidth={2.5} /> New booking
      </Link>

      {/* Upcoming */}
      <div className="mb-6">
        <p className="mb-3 text-[13px] font-medium uppercase tracking-wide text-slate-400">Upcoming</p>
        {upcoming.length === 0 ? (
          <div className="rounded-[14px] border border-white/[0.07] bg-[#14181c] text-center py-8 text-slate-500 text-sm">
            No upcoming bookings — <Link href="/book" className="text-emerald-400 hover:underline">book a court</Link>
          </div>
        ) : (
          <div className="space-y-3">
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

      {/* Past */}
      {past.length > 0 && (
        <div>
          <p className="mb-3 text-[13px] font-medium uppercase tracking-wide text-slate-500">Past &amp; cancelled</p>
          <div className="space-y-3 opacity-60">
            {past.map(b => (
              <BookingRow key={b.id} booking={b} past />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  accent,
  small,
}: {
  label: string
  value: string
  accent?: boolean
  small?: boolean
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#14181c] px-4 py-3.5">
      <div className="mb-1.5 text-xs text-slate-400">{label}</div>
      <div className={cn('font-medium', small ? 'mt-1 text-lg' : 'text-2xl', accent ? 'text-emerald-400' : 'text-slate-100')}>
        {value}
      </div>
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
  const duration = minutesBetween(b.start_time, b.end_time)
  const paymentPending = b.payment_method === 'pay_at_venue'
  const freeCancel = hoursUntil(b.date, b.start_time) >= 24
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${b.courts?.name ?? ''} padel court`)}`

  const badge =
    b.status === 'confirmed'
      ? 'text-emerald-400 bg-emerald-500/[0.12]'
      : b.status === 'pending'
      ? 'text-amber-400 bg-amber-400/[0.12]'
      : 'text-slate-400 bg-white/[0.06]'

  return (
    <div className="rounded-[14px] border border-white/[0.07] bg-[#14181c] px-5 py-[18px]">
      <div className="flex items-start justify-between mb-4">
        <div className="flex gap-3">
          <div className="w-[42px] h-[42px] shrink-0 rounded-[10px] bg-emerald-500/10 flex items-center justify-center text-emerald-400 text-lg">
            🎾
          </div>
          <div>
            <div className="text-[15px] font-medium text-slate-100">{b.courts?.name} — {b.courts?.type}</div>
            <div className="text-[13px] text-slate-400 mt-1">
              {formatDate(b.date)} · {b.start_time.slice(0, 5)}–{b.end_time.slice(0, 5)} · {duration} min
            </div>
          </div>
        </div>
        <div className="text-right">
          <span className={cn('inline-block rounded-full px-2.5 py-[3px] text-[11px] font-medium capitalize', badge)}>
            {b.status}
          </span>
          <div className="text-xl font-medium text-slate-100 mt-2">{formatNzd(b.price_nzd)}</div>
          {paymentPending && <div className="text-[11px] text-amber-400 mt-px">Payment pending</div>}
        </div>
      </div>

      {!past && (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-[10px] border border-blue-400/25 bg-blue-400/[0.08] px-4 py-[11px] text-sm font-medium text-blue-400 transition-colors hover:bg-blue-400/[0.14]"
        >
          <Navigation className="h-4 w-4" /> Take me to the court
        </a>
      )}

      {!past && b.status === 'confirmed' && (
        <div className="flex items-center justify-between border-t border-white/[0.06] pt-3.5">
          <span className="text-xs text-slate-500 capitalize">{b.payment_method?.replace('_', ' ')}</span>
          <button
            onClick={onCancel}
            disabled={cancelling}
            className="px-2 py-1 text-xs text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
          >
            {cancelling ? 'Cancelling…' : `Cancel · ${freeCancel ? 'no charge' : '50% credit'}`}
          </button>
        </div>
      )}
    </div>
  )
}



