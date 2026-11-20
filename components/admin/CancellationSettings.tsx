'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { FREE_HOURS, afterText, hoursWord, type CancellationRule } from '@/lib/cancellation-rules'

const card = { background: 'var(--bg-surface)', border: '1px solid var(--border)' } as const
const muted = { color: 'var(--text-muted)' } as const

// A club's cancellation rule. Saves as it is changed. Players see it before they pay and when they cancel.
export default function CancellationSettings({ venueSlug, rule }: { venueSlug: string; rule: CancellationRule | null }) {
  const router = useRouter()
  const [r, setR] = useState<CancellationRule | null>(rule)
  const [busy, setBusy] = useState(false)

  const save = async (patch: Partial<CancellationRule>) => {
    if (!r) return
    const before = r
    setR({ ...r, ...patch }); setBusy(true)
    try {
      const res = await fetch('/api/admin/cancellation-rule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ venueSlug, ...patch }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setR(before); toast.error(data.error ?? 'Could not save.') } else { toast.success('Saved'); router.refresh() }
    } catch { setR(before); toast.error('Could not save. Check your connection and try again.') }
    setBusy(false)
  }
  const Seg = ({ on, label, onClick, id }: { on: boolean; label: string; onClick: () => void; id: string }) => (
    <button type="button" aria-pressed={on} disabled={busy} onClick={onClick} data-testid={id} className="flex-1 rounded-full px-2 text-[13px] font-semibold disabled:opacity-60"
      style={{ minHeight: 36, background: on ? 'var(--brand-primary-muted)' : 'transparent', color: on ? 'var(--brand-primary-text)' : 'var(--text-muted)', border: `1px solid ${on ? 'var(--brand-primary)' : 'transparent'}` }}>{label}</button>
  )

  return (
    <div className="rounded-[20px] p-5" style={card} data-testid="cancellation-settings">
      <span className="block text-[11px] font-extrabold uppercase" style={{ letterSpacing: '0.12em', color: 'var(--text-subtle)' }}>Cancellations</span>
      {r ? (
        <>
          <span className="block text-[26px] font-black leading-tight mt-1" style={{ letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>{hoursWord(r.freeHours)}</span>
          <span className="block text-xs mt-0.5" style={muted}>Free cancellation until this long before play. Players see it before they pay.</span>
          <div className="mt-3 pt-3 grid gap-3" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="cancel-hours" className="text-xs font-bold" style={muted}>Free cancellation until</label>
              <select id="cancel-hours" value={r.freeHours} disabled={busy} onChange={e => void save({ freeHours: Number(e.target.value) })}
                className="rounded-xl px-3 text-sm" style={{ minHeight: 40, background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                {FREE_HOURS.map(h => <option key={h} value={h}>{hoursWord(h)} before</option>)}
              </select>
            </div>
            <div>
              <span className="block text-xs font-bold mb-1.5" style={muted}>After that, if they cancel</span>
              <div className="flex gap-1 rounded-full p-1" style={{ background: 'var(--bg-raised)' }} role="group" aria-label="After that, if they cancel">
                <Seg id="after-keep" on={r.after === 'keep'} label="Keep it all" onClick={() => void save({ after: 'keep' })} />
                <Seg id="after-half" on={r.after === 'half'} label="Half back" onClick={() => void save({ after: 'half' })} />
              </div>
            </div>
            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-subtle)' }}>{afterText(r)} Half back means account credit to use on their next booking. Everyone else on a split booking is always refunded in full, and a booking you cancel yourself is always refunded in full.</p>
          </div>
        </>
      ) : <span className="block text-xs mt-1" style={muted}>Not switched on yet. Run the 037 database change first.</span>}
    </div>
  )
}
