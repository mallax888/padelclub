'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { BODY_MAX, TITLE_MAX, ageLabel } from '@/lib/announcements'

type Recent = { id: string; title: string; created_at: string; expires_at: string; told_count: number }
const card = { background: 'var(--bg-surface)', border: '1px solid var(--border)' } as const
const muted = { color: 'var(--text-muted)' } as const

// "Message your players": an owner writes one short message that goes to everyone who plays at the club.
export default function AnnouncementCard({ venueSlug, venueName }: { venueSlug: string; venueName: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [info, setInfo] = useState<{ reach: number; available: boolean; recent: Recent[] } | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [push, setPush] = useState(true)
  const [email, setEmail] = useState(false)
  const [home, setHome] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    try {
      const res = await fetch(`/api/admin/announcements?venue=${encodeURIComponent(venueSlug)}`)
      if (res.ok) setInfo(await res.json())
    } catch { /* the card still works without the count */ }
  }
  useEffect(() => { void load() }, [venueSlug]) // eslint-disable-line react-hooks/exhaustive-deps

  const send = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/announcements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ venueSlug, title, body, push, email, home }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) toast.error(d.error ?? 'Could not send that.')
      else { toast.success(`Sent to ${d.told} ${d.told === 1 ? 'player' : 'players'}`); setOpen(false); setTitle(''); setBody(''); await load(); router.refresh() }
    } catch { toast.error('Could not send that. Check your connection and try again.') }
    setBusy(false)
  }
  const endNotice = async (id: string) => {
    const res = await fetch('/api/admin/announcements/end', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    if (res.ok) { toast.success('Taken off Home'); await load() } else toast.error('Could not remove that.')
  }
  const Switch = ({ on, label, onClick, id }: { on: boolean; label: string; onClick: () => void; id: string }) => (
    <button type="button" role="switch" aria-checked={on} onClick={onClick} data-testid={id} className="flex items-center justify-between w-full py-2.5 text-sm" style={{ color: 'var(--text-primary)' }}>
      <span>{label}</span>
      <span className="relative rounded-full shrink-0" style={{ width: 46, height: 26, background: on ? '#1f9a5f' : 'var(--bg-raised)', border: '1px solid var(--border)' }}>
        <span aria-hidden className="absolute rounded-full" style={{ top: 2, left: on ? 22 : 2, width: 20, height: 20, background: on ? '#ffffff' : 'var(--text-subtle)', transition: 'left .15s' }} />
      </span>
    </button>
  )
  const active = (info?.recent ?? []).filter(r => Date.parse(r.expires_at) > Date.now())

  return (
    <>
      <div className="rounded-[20px] p-5" style={card} data-testid="announcement-card">
        <div className="text-[11px] font-extrabold uppercase mb-2" style={{ letterSpacing: '0.14em', color: 'var(--text-subtle)' }}>Message your players</div>
        <p className="text-sm" style={muted}>Tell everyone who plays at {venueName} about a closure, an event or news.{info && info.available ? ` Reaches ${info.reach} ${info.reach === 1 ? 'person' : 'people'}.` : ''}</p>
        <button type="button" onClick={() => setOpen(true)} className="btn-main mt-3" data-testid="announce-open" disabled={info !== null && !info.available}>
          {info !== null && !info.available ? 'Not switched on yet' : 'Write a message'}
        </button>
        {info && !info.available && <p className="text-[11px] mt-2" style={{ color: 'var(--text-subtle)' }}>Run the 038 database change first.</p>}
        {active.length > 0 && (
          <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="text-[11px] font-extrabold uppercase mb-1" style={{ letterSpacing: '0.12em', color: 'var(--text-subtle)' }}>Showing on Home</div>
            {active.map(r => (
              <div key={r.id} className="flex items-center gap-3 py-2" data-testid="active-notice">
                <span className="min-w-0 flex-1"><span className="block text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{r.title}</span><span className="block text-[11.5px]" style={muted}>{ageLabel(r.created_at, Date.now())} · told {r.told_count}</span></span>
                <button type="button" onClick={() => void endNotice(r.id)} className="text-xs font-semibold shrink-0" style={muted} data-testid="end-notice">Take off Home</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center" role="dialog" aria-modal="true" aria-label="Message your players">
          <div className="absolute inset-0" style={{ background: 'rgba(10,12,15,0.55)' }} onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-md max-h-[92vh] overflow-y-auto rounded-t-[26px] md:rounded-[26px] px-5 pt-5" style={{ ...card, paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>
            <div className="text-[19px] font-extrabold" style={{ color: 'var(--text-primary)' }}>Message your players</div>
            <div className="text-xs mt-0.5" style={muted}>{venueName}</div>
            <label className="block text-[11px] font-extrabold uppercase mt-4 mb-1" style={{ letterSpacing: '0.1em', color: 'var(--text-muted)' }} htmlFor="ann-title">Headline</label>
            <input id="ann-title" className="input w-full" maxLength={TITLE_MAX} value={title} onChange={e => setTitle(e.target.value)} placeholder="Court 2 closed Saturday" data-testid="announce-title" />
            <label className="block text-[11px] font-extrabold uppercase mt-4 mb-1" style={{ letterSpacing: '0.1em', color: 'var(--text-muted)' }} htmlFor="ann-body">Message (optional)</label>
            <textarea id="ann-body" className="input w-full" rows={4} maxLength={BODY_MAX} value={body} onChange={e => setBody(e.target.value)} placeholder="We are resurfacing it. Courts 1 and 3 are open as normal." data-testid="announce-body" />
            <div className="text-right text-[11px]" style={{ color: 'var(--text-subtle)' }}>{body.length}/{BODY_MAX}</div>
            <div className="mt-1" style={{ borderTop: '1px solid var(--border)' }}>
              <Switch id="announce-push" on={push} label="Notify their phones" onClick={() => setPush(!push)} />
              <Switch id="announce-email" on={email} label="Also email them" onClick={() => setEmail(!email)} />
              <Switch id="announce-home" on={home} label="Keep on Home for 7 days" onClick={() => setHome(!home)} />
            </div>
            <button type="button" onClick={() => void send()} disabled={busy || title.trim().length === 0 || (!push && !email && !home)} className="btn-main mt-3 disabled:opacity-60" data-testid="announce-send">
              {busy ? 'Sending…' : info ? `Send to ${info.reach} ${info.reach === 1 ? 'player' : 'players'}` : 'Send'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="w-full mt-1 py-2.5 text-sm" style={{ color: 'var(--text-subtle)' }}>Cancel</button>
          </div>
        </div>
      )}
    </>
  )
}
