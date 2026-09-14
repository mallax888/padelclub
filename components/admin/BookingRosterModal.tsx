'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { formatPrice, type CurrencyCode } from '@/lib/currency'
import type { Profile } from '@/types/database'

type RosterPlayer = {
  id: string
  playerId: string | null
  rowId: string | null
  name: string
  role: 'organizer' | 'invited' | 'joined'
  replacedName: string | null
  paymentStatus?: string
  amount?: number
  joinStatus?: string | null
}

type RosterResponse =
  | { type: 'split'; players: RosterPlayer[]; priceNzd: number; paidTotal: number }
  | { type: 'open_play'; players: RosterPlayer[]; priceNzd: number }

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
  members,
  onClose,
}: {
  bookingId: string
  title: string
  subtitle: string
  currency: CurrencyCode
  members: Profile[]
  onClose: () => void
}) {
  const [data, setData] = useState<RosterResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [replacingRowId, setReplacingRowId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/booking-roster?bookingId=${bookingId}`)
      const json = await res.json()
      if (json.error) setError(json.error)
      else { setData(json); setError(null) }
    } catch {
      setError('Could not load roster')
    }
  }, [bookingId])

  useEffect(() => { load() }, [load])

  const replacePlayer = async (rowId: string, newPlayerId: string) => {
    if (!data) return
    setSaving(true)
    const res = await fetch('/api/admin/replace-player', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: data.type === 'split' ? 'split' : 'open_match', rowId, newPlayerId }),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) {
      toast.error(json.error ?? 'Could not replace that player')
      return
    }
    toast.success('Seat transferred')
    setReplacingRowId(null)
    setSearch('')
    load()
  }

  // Anyone already on this booking is excluded: giving them a second seat
  // would list them twice and double-count them in the collected total.
  const alreadyOnBooking = new Set((data?.players ?? []).map(p => p.playerId).filter(Boolean) as string[])
  const memberMatches = search.trim().length === 0 ? [] : members
    .filter(m => !alreadyOnBooking.has(m.id))
    .filter(m => {
      const name = ((m as any).nickname ?? m.full_name ?? '').toLowerCase()
      return name.includes(search.trim().toLowerCase())
    })
    .slice(0, 5)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="rounded-2xl w-full max-w-sm overflow-hidden max-h-[85vh] flex flex-col"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
        <div className="flex items-start justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <div className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{title}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>{subtitle}</div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>✕</button>
        </div>

        <div className="px-2 py-2 overflow-y-auto">
          {error ? (
            <div className="px-3 py-6 text-sm text-center" style={{ color: 'var(--text-subtle)' }}>{error}</div>
          ) : !data ? (
            <div className="px-3 py-6 text-sm text-center" style={{ color: 'var(--text-subtle)' }}>Loading…</div>
          ) : (
            data.players.map(p => {
              const statusKey = data.type === 'split' ? p.paymentStatus : (p.joinStatus ?? 'accepted')
              const badge = statusKey ? STATUS_BADGE[statusKey] : undefined
              const isReplacing = replacingRowId !== null && replacingRowId === p.rowId
              return (
                <div key={p.rowId ?? p.id}>
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                    style={isReplacing ? { background: 'var(--bg-raised)', outline: '1px solid var(--brand-primary-muted)' } : undefined}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: 'var(--brand-primary)', color: 'var(--brand-primary-on)' }}>
                      {p.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{p.name}</div>
                      <div className="text-xs capitalize truncate" style={{ color: 'var(--text-subtle)' }}>
                        {p.role}{p.replacedName ? ` · took ${p.replacedName}'s seat` : ''}
                      </div>
                    </div>
                    {badge && (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0" style={{ background: badge.bg, color: badge.color }}>
                        {badge.label}
                      </span>
                    )}
                    {p.rowId && (
                      <button
                        onClick={() => { setReplacingRowId(isReplacing ? null : p.rowId); setSearch('') }}
                        title="Replace this player"
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs"
                        style={isReplacing
                          ? { background: 'var(--brand-primary)', color: 'var(--brand-primary-on)', border: '1px solid var(--brand-primary)' }
                          : { background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                        ↻
                      </button>
                    )}
                  </div>

                  {isReplacing && (
                    <div className="mx-2 mb-2 p-3 rounded-xl" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
                      <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Who&apos;s taking {p.name}&apos;s place?</div>
                      <input
                        autoFocus
                        className="input text-sm w-full"
                        placeholder="Search members…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                      />
                      {memberMatches.map(m => (
                        <button key={m.id} disabled={saving}
                          onClick={() => replacePlayer(p.rowId!, m.id)}
                          className="w-full flex items-center gap-2 px-2 py-2 mt-1.5 rounded-lg text-left transition-colors"
                          style={{ background: 'transparent', color: 'var(--text-primary)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                            style={{ background: 'var(--brand-primary)', color: 'var(--brand-primary-on)' }}>
                            {(((m as any).nickname ?? m.full_name ?? '—') as string).slice(0, 1).toUpperCase()}
                          </div>
                          <span className="text-xs truncate">{(m as any).nickname ?? m.full_name ?? '—'}</span>
                        </button>
                      ))}
                      {search.trim().length > 0 && memberMatches.length === 0 && (
                        <div className="text-xs mt-2" style={{ color: 'var(--text-subtle)' }}>No members match that name.</div>
                      )}
                      <div className="text-[11px] mt-2 leading-relaxed" style={{ color: 'var(--text-subtle)' }}>
                        The seat keeps its payment as-is — no refund is issued and the replacement isn&apos;t charged again.
                      </div>
                    </div>
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
