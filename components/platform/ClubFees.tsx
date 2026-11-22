'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'

export type ClubFee = { venueSlug: string; name: string; state: string; percent: number; fixed: number }

const card = { background: 'var(--bg-surface)', border: '1px solid var(--border)' } as const
const input = { minHeight: 40, background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)', width: 84 } as const

// The platform admin's fee for each club that has started connecting Stripe.
export default function ClubFees({ clubs }: { clubs: ClubFee[] }) {
  return (
    <div className="mt-8" data-testid="club-fees">
      <h2 className="text-lg font-extrabold mb-1" style={{ color: 'var(--text-primary)' }}>Club payments</h2>
      <p className="text-xs mb-3 leading-relaxed" style={{ color: 'var(--text-muted)' }}>PadelMate&apos;s fee on each card payment to a club. The club pays Stripe&apos;s own card fee. Only you can change this; owners see the result on their own screen.</p>
      {clubs.length === 0
        ? <p className="text-sm rounded-2xl p-4" style={{ ...card, color: 'var(--text-muted)' }}>No club has started connecting Stripe yet.</p>
        : <div className="grid gap-3">{clubs.map(c => <Row key={c.venueSlug} club={c} />)}</div>}
    </div>
  )
}

function Row({ club }: { club: ClubFee }) {
  const [percent, setPercent] = useState(String(club.percent))
  const [fixed, setFixed] = useState(String(club.fixed))
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true)
    const res = await fetch('/api/platform/club-fees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ venueSlug: club.venueSlug, percent, fixed }) })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { toast.error(data.error ?? 'Could not save.'); return }
    setPercent(String(data.fee.percent)); setFixed(String(data.fee.fixed)); toast.success(`Fee saved for ${club.name}`)
  }
  return (
    <div className="rounded-2xl px-4 py-3.5" style={card} data-testid={`fee-${club.venueSlug}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-extrabold text-[15px]" style={{ color: 'var(--text-primary)' }}>{club.name}</span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{club.state === 'ready' ? 'Connected' : club.state === 'checking' ? 'Stripe is checking' : 'Not finished'}</span>
      </div>
      <div className="flex items-end gap-3 mt-3 flex-wrap">
        <label className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>Fee %
          <input aria-label={`Fee percent for ${club.name}`} inputMode="decimal" value={percent} onChange={e => setPercent(e.target.value.replace(/[^0-9.]/g, '').slice(0, 5))} className="block mt-1 rounded-xl px-3 text-sm" style={input} />
        </label>
        <label className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>Plus fixed per payment
          <input aria-label={`Fixed fee for ${club.name}`} inputMode="decimal" value={fixed} onChange={e => setFixed(e.target.value.replace(/[^0-9.]/g, '').slice(0, 5))} className="block mt-1 rounded-xl px-3 text-sm" style={input} />
        </label>
        <button type="button" disabled={busy} onClick={() => void save()} className="rounded-xl px-4 text-sm font-extrabold disabled:opacity-50" style={{ minHeight: 40, background: 'var(--brand-primary)', color: 'var(--brand-primary-on)' }}>Save fee</button>
      </div>
    </div>
  )
}
