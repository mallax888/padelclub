'use client'

import { useEffect, useState } from 'react'
import { formatPrice, type CurrencyCode } from '@/lib/currency'

type SplitPlayer = { id: string; name: string; role: 'organizer' | 'invited'; paymentStatus: string; amount: number }
type OpenPlayPlayer = { id: string; name: string; role: 'organizer' | 'joined'; joinStatus: string | null }

type RosterResponse =
  | { type: 'split'; players: SplitPlayer[]; priceNzd: number; paidTotal: number }
  | { type: 'open_play'; players: OpenPlayPlayer[]; priceNzd: number }

const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  paid: { label: 'Paid', bg: 'var(--brand-primary-muted)', color: 'var(--brand-primary-text)' },
  pending: { label: 'Pending', bg: '#F59E0B26', color: '#F59E0B' },
  accepted: { label: 'Joined', bg: 'var(--brand-primary-muted)', color: 'var(--brand-primary-text)' },
}

export default function BookingRosterModal({
  bookingId,
  title,
  subtitle,
  currency,
  onClose,
}: {
  bookingId: string
  title: string
  subtitle: string
  currency: CurrencyCode
  onClose: () => void
}) {
  const [data, setData] = useState<RosterResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/admin/booking-roster?bookingId=${bookingId}`)
      .then(res => res.json())
      .then(json => { if (!cancelled) { if (json.error) setError(json.error); else setData(json) } })
      .catch(() => { if (!cancelled) setError('Could not load roster') })
    return () => { cancelled = true }
  }, [bookingId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="rounded-2xl w-full max-w-sm overflow-hidden"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
        <div className="flex items-start justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <div className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{title}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>{subtitle}</div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>✕</button>
        </div>

        <div className="px-2 py-2">
          {error ? (
            <div className="px-3 py-6 text-sm text-center" style={{ color: 'var(--text-subtle)' }}>{error}</div>
          ) : !data ? (
            <div className="px-3 py-6 text-sm text-center" style={{ color: 'var(--text-subtle)' }}>Loading…</div>
          ) : (
            data.players.map(p => {
              const statusKey = data.type === 'split' ? (p as SplitPlayer).paymentStatus : ((p as OpenPlayPlayer).joinStatus ?? 'accepted')
              const badge = STATUS_BADGE[statusKey]
              return (
                <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: 'var(--brand-primary)', color: 'var(--brand-primary-on)' }}>
                    {p.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{p.name}</div>
                    <div className="text-xs capitalize" style={{ color: 'var(--text-subtle)' }}>{p.role}</div>
                  </div>
                  {badge && (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0" style={{ background: badge.bg, color: badge.color }}>
                      {badge.label}
                    </span>
                  )}
                </div>
              )
            })
          )}
        </div>

        {data && data.type === 'split' && (
          <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid var(--border)' }}>
            <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>Total collected</span>
            <span className="text-sm font-bold" style={{ color: data.paidTotal >= data.priceNzd ? 'var(--brand-primary-text)' : '#F59E0B' }}>
              {formatPrice(data.paidTotal, currency)} of {formatPrice(data.priceNzd, currency)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
