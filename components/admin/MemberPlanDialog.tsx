'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import type { Plan } from '@/lib/plan-rules'

const field = { minHeight: 44, background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' } as const

// Owner: put a member on one of the club's plans for free until a date, or back on
// Casual. The server checks the owner, the member's club and the date again.
export default function MemberPlanDialog({ member, plans, onClose }: {
  member: { id: string; name: string; tier: string }
  plans: Plan[]
  onClose: () => void
}) {
  const router = useRouter()
  const [planKey, setPlanKey] = useState(member.tier)
  const [endsOn, setEndsOn] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const casual = planKey === 'casual'
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)

  async function save() {
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/admin/members/plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: member.id, planKey, endsOn: casual ? null : endsOn }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d.error ?? 'Could not save.'); setBusy(false); return }
      toast.success(casual ? `${member.name} is back on Casual` : `${member.name} is on ${d.planName}`)
      router.refresh()
      onClose()
    } catch {
      setError('Could not save. Check your connection and try again.'); setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }} role="dialog" aria-modal="true" aria-label="Change plan" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-sm rounded-2xl p-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-extrabold uppercase" style={{ letterSpacing: '0.14em', color: 'var(--text-subtle)' }}>Change plan</div>
            <div className="text-lg font-extrabold mt-1" style={{ color: 'var(--text-primary)' }}>{member.name}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-xl leading-none px-2" style={{ color: 'var(--text-muted)' }}>×</button>
        </div>

        <label htmlFor="mp-plan" className="block text-[11px] font-extrabold uppercase mt-4 mb-1.5" style={{ letterSpacing: '0.12em', color: 'var(--text-subtle)' }}>Plan</label>
        <select id="mp-plan" value={planKey} onChange={e => setPlanKey(e.target.value)} className="w-full rounded-xl px-3 text-sm font-semibold" style={field}>
          {plans.map(p => <option key={p.key} value={p.key}>{p.key === 'casual' ? 'Casual (no plan)' : `${p.name}${p.active ? '' : ' (not offered)'}`}</option>)}
        </select>

        {!casual && (
          <>
            <label htmlFor="mp-end" className="block text-[11px] font-extrabold uppercase mt-4 mb-1.5" style={{ letterSpacing: '0.12em', color: 'var(--text-subtle)' }}>Free until</label>
            <input id="mp-end" type="date" min={tomorrow} value={endsOn} onChange={e => setEndsOn(e.target.value)} className="w-full rounded-xl px-3 text-sm font-semibold" style={field} />
          </>
        )}
        <p className="text-[11.5px] mt-3 leading-relaxed" style={{ color: 'var(--text-subtle)' }}>
          {casual ? 'This ends their current plan now. Anything they paid is not refunded.' : 'It shows as given by you, not a payment, and ends on its own on that date. It replaces any plan they have now.'}
        </p>
        {error && <p className="text-sm mt-3" role="alert" style={{ color: 'var(--brand-crimson)' }}>{error}</p>}

        <div className="flex gap-2 mt-4">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl py-2.5 text-sm font-bold" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>Cancel</button>
          <button type="button" onClick={save} disabled={busy || (!casual && !endsOn) || planKey === member.tier && casual} className="flex-[2] rounded-xl py-2.5 text-sm font-extrabold disabled:opacity-50" style={{ background: 'var(--brand-primary)', color: 'var(--brand-primary-on)' }}>
            {busy ? 'Saving…' : casual ? 'Move to Casual' : 'Give this plan'}
          </button>
        </div>
      </div>
    </div>
  )
}
