'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { BODY_MAX, TITLE_MAX } from '@/lib/announcements'
import type { Segment } from '@/lib/club-players'

// What the owner writes to a group of their players. One headline, one message, and how it goes. It sends through the same
// notification and email path as club announcements, but only to the group, and never onto everyone's Home screen.
export type MessageTarget = { segment: Segment; count: number } | { playerId: string; name: string }

const starter = (t: MessageTarget, club: string): { title: string; body: string } => {
  if ('playerId' in t) return { title: 'A quick note', body: '' }
  switch (t.segment) {
    case 'quiet': return { title: 'We have missed you', body: `Come and play at ${club} this week. The courts are open and we would love to see you.` }
    case 'owes': return { title: 'A quick reminder', body: 'You have a share still to pay for an upcoming game. You can pay it in My bookings.' }
    case 'link':
    case 'new': return { title: `Welcome to ${club}`, body: 'Great to have you. Book your next game any time, or join an open match to meet other players.' }
    case 'members': return { title: 'A note for our members', body: '' }
    default: return { title: `News from ${club}`, body: '' }
  }
}

export default function MessageSheet({ venueSlug, club, target, onClose }: { venueSlug: string; club: string; target: MessageTarget; onClose: () => void }) {
  const router = useRouter()
  const start = starter(target, club)
  const [title, setTitle] = useState(start.title)
  const [body, setBody] = useState(start.body)
  const [push, setPush] = useState(true)
  const [email, setEmail] = useState(false)
  const [busy, setBusy] = useState(false)
  const who = 'playerId' in target ? target.name : `${target.count} ${target.count === 1 ? 'player' : 'players'}`
  const field = { background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-primary)' } as const
  const chip = (on: boolean) => ({ background: on ? 'linear-gradient(160deg, #2c5fc4, #1d3f8d)' : 'var(--bg-base)', border: on ? '1px solid #6ea0ff' : '1px solid var(--border)', color: on ? '#fff' : 'var(--text-muted)' }) as const

  async function send() {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/message-players', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ venueSlug, ...('playerId' in target ? { playerId: target.playerId } : { segment: target.segment }), title, body, push, email }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(json.error ?? 'Could not send that. Please try again.'); setBusy(false); return }
      toast.success(`Sent to ${json.told} ${json.told === 1 ? 'player' : 'players'}`)
      router.refresh(); onClose()
    } catch { toast.error('Could not send that. Please try again.'); setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={`Message ${who}`} data-testid="message-sheet"
      style={{ background: 'rgba(0,0,0,0.55)' }} onClick={() => !busy && onClose()}>
      <div className="w-full max-w-md rounded-t-[26px] sm:rounded-[26px] p-5 pb-7" style={{ background: 'var(--bg-surface)', border: '1px solid var(--brand-primary)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[20px] font-extrabold" style={{ color: 'var(--text-primary)' }}>Message {who}</h2>
            <p className="text-[12.5px] mt-0.5 mb-4" style={{ color: 'var(--text-muted)' }}>{'playerId' in target ? 'Goes to them only.' : 'Everyone in this group who plays at the club.'}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-lg px-2" style={{ color: 'var(--text-subtle)' }}>✕</button>
        </div>
        <label className="block text-[10.5px] font-extrabold uppercase mb-1.5" style={{ letterSpacing: '0.12em', color: 'var(--text-subtle)' }} htmlFor="msg-title">Headline</label>
        <input id="msg-title" data-testid="msg-title" value={title} maxLength={TITLE_MAX} onChange={e => setTitle(e.target.value)} className="w-full rounded-[14px] px-3.5 py-3 text-[14.5px] font-bold mb-3" style={field} />
        <label className="block text-[10.5px] font-extrabold uppercase mb-1.5" style={{ letterSpacing: '0.12em', color: 'var(--text-subtle)' }} htmlFor="msg-body">Message</label>
        <textarea id="msg-body" data-testid="msg-body" value={body} maxLength={BODY_MAX} onChange={e => setBody(e.target.value)} rows={4} className="w-full rounded-[14px] px-3.5 py-3 text-[14px] leading-relaxed mb-3" style={field} />
        <div className="text-[10.5px] font-extrabold uppercase mb-1.5" style={{ letterSpacing: '0.12em', color: 'var(--text-subtle)' }}>Send by</div>
        <div className="flex gap-2 mb-4">
          <button type="button" aria-pressed={push} onClick={() => setPush(p => !p)} className="flex-1 rounded-[13px] py-2.5 text-[13px] font-extrabold" style={chip(push)}>Notification</button>
          <button type="button" aria-pressed={email} onClick={() => setEmail(e => !e)} className="flex-1 rounded-[13px] py-2.5 text-[13px] font-extrabold" style={chip(email)}>Email</button>
        </div>
        <button type="button" onClick={send} disabled={busy || (!push && !email) || title.trim().length === 0} data-testid="msg-send"
          className="w-full rounded-full py-3.5 text-[15px] font-black" style={{ background: '#d4f53c', color: '#17240a', opacity: busy || (!push && !email) || title.trim().length === 0 ? 0.55 : 1, minHeight: 50 }}>
          {busy ? 'Sending…' : `Send to ${who}`}
        </button>
        {!push && !email && <p className="text-[12px] mt-2 text-center" style={{ color: 'var(--text-muted)' }}>Choose notification, email or both.</p>}
      </div>
    </div>
  )
}
