'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { BRIEFING_HOURS, hourLabel, type BriefingSettings as Settings } from '@/lib/briefing'

const card = { background: 'var(--bg-surface)', border: '1px solid var(--border)' } as const
const muted = { color: 'var(--text-muted)' } as const

// A club's morning briefing: on or off, the time, and phone and email. Saves as it is changed.
export default function BriefingSettings({ venueSlug, settings }: { venueSlug: string; settings: Settings | null }) {
  const router = useRouter()
  const [s, setS] = useState<Settings | null>(settings)
  const [busy, setBusy] = useState(false)

  const save = async (patch: Partial<Settings>) => {
    if (!s) return
    const before = s
    setS({ ...s, ...patch }); setBusy(true)
    try {
      const res = await fetch('/api/admin/briefing-settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ venueSlug, ...patch }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setS(before); toast.error(data.error ?? 'Could not save.') } else { toast.success('Saved'); router.refresh() }
    } catch { setS(before); toast.error('Could not save. Check your connection and try again.') }
    setBusy(false)
  }
  const Pill = ({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) => (
    <button type="button" aria-pressed={on} disabled={busy} onClick={onClick} className="rounded-full px-3.5 text-[12.5px] font-bold disabled:opacity-60"
      style={{ minHeight: 36, background: on ? 'var(--brand-primary)' : 'var(--bg-raised)', color: on ? 'var(--brand-primary-on)' : 'var(--text-muted)', border: `1px solid ${on ? 'var(--brand-primary)' : 'var(--border)'}` }}>{label}</button>
  )

  return (
    <div className="rounded-[20px] p-5" style={card} data-testid="briefing-settings">
      <div className="flex items-center gap-3">
        <span className="min-w-0">
          <span className="block text-[11px] font-extrabold uppercase" style={{ letterSpacing: '0.12em', color: 'var(--text-subtle)' }}>Morning briefing</span>
          {s && <span className="block text-[26px] font-black leading-tight mt-1" style={{ letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>{s.enabled ? hourLabel(s.hour) : 'Off'}</span>}
          <span className="block text-xs mt-0.5" style={muted}>{s ? (s.enabled ? `Owners get yesterday's numbers at ${hourLabel(s.hour)}` : 'Off: owners get nothing') : "Not switched on yet. Run the 035 database change."}</span>
        </span>
        {s && (
          <button type="button" role="switch" aria-checked={s.enabled} aria-label="Morning briefing" disabled={busy} onClick={() => void save({ enabled: !s.enabled })}
            className="ml-auto shrink-0 relative rounded-full disabled:opacity-60" data-testid="briefing-switch"
            style={{ width: 46, height: 28, background: s.enabled ? '#d4f53c' : 'var(--bg-raised)', border: '1px solid var(--border)' }}>
            <span aria-hidden className="absolute rounded-full" style={{ top: 3, left: s.enabled ? 21 : 3, width: 20, height: 20, background: s.enabled ? '#17240a' : 'var(--text-subtle)', transition: 'left .15s' }} />
          </button>
        )}
      </div>
      {s && s.enabled && (
        <div className="mt-3 pt-3 grid gap-3" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="briefing-hour" className="text-xs font-bold" style={muted}>Send it at</label>
            <select id="briefing-hour" value={s.hour} disabled={busy} onChange={e => void save({ hour: Number(e.target.value) })}
              className="rounded-xl px-3 text-sm" style={{ minHeight: 40, background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              {BRIEFING_HOURS.map(h => <option key={h} value={h}>{hourLabel(h)}</option>)}
            </select>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-bold" style={muted}>Send it by</span>
            <span className="flex gap-2"><Pill on={s.push} label="Phone" onClick={() => void save({ push: !s.push })} /><Pill on={s.email} label="Email" onClick={() => void save({ email: !s.email })} /></span>
          </div>
          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-subtle)' }}>It goes to this club&apos;s owners, in the club&apos;s own time zone, and also shows in the bell. Front desk never gets it, because it has takings in it.</p>
        </div>
      )}
    </div>
  )
}
