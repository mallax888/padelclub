'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { FOOTER_TEXT, emailCopy } from '@/lib/contact-rules'

// The single reminder to people who were invited and have not joined. Shows the exact email first, asks for the tick,
// and says plainly that this is the only one: nobody is ever reminded twice.
export default function ReminderSheet({ venueSlug, club, count, emailReady, onClose }: { venueSlug: string; club: string; count: number; emailReady: boolean; onClose: () => void }) {
  const router = useRouter()
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const copy = emailCopy('remind', club)

  async function send() {
    setBusy(true); setError(null); let sent = 0
    try {
      for (let guard = 0; guard < 200; guard++) {
        const res = await fetch('/api/admin/contacts/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ venueSlug, mode: 'remind', confirmed: true }) })
        const j = await res.json().catch(() => ({}))
        if (!res.ok) { setError(j.error ?? 'Could not send the reminder.'); setBusy(false); return }
        sent += j.sent ?? 0
        if ((j.remaining ?? 0) === 0 || (j.sent ?? 0) + (j.joined ?? 0) === 0) break
      }
      toast.success(`Reminder sent to ${sent} ${sent === 1 ? 'person' : 'people'}`)
      router.refresh(); onClose()
    } catch { setError('Could not send the reminder. Please try again.'); setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Send the reminder" data-testid="reminder-sheet" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={() => !busy && onClose()}>
      <div className="w-full max-w-md rounded-t-[26px] sm:rounded-[26px] p-5 pb-7 max-h-[92vh] overflow-y-auto" style={{ background: 'var(--bg-surface)', border: '1px solid var(--brand-primary)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[20px] font-extrabold" style={{ color: 'var(--text-primary)' }}>Send the reminder</h2>
            <p className="text-[12.5px] mt-0.5 mb-3" style={{ color: 'var(--text-muted)' }}>{count} {count === 1 ? 'person was' : 'people were'} invited over a week ago and have not joined.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-lg px-2" style={{ color: 'var(--text-subtle)' }}>✕</button>
        </div>
        <div className="rounded-2xl p-4" style={{ background: '#fff', color: '#1a1f24' }} data-testid="reminder-preview">
          <h3 className="text-[16px] font-extrabold mb-1" style={{ border: 0, padding: 0, color: '#1a1f24' }}>{copy.heading}</h3>
          <p className="text-[13.5px] leading-relaxed">{copy.intro}</p>
          <span className="inline-block mt-2.5 rounded-full px-4 py-2 text-[13px] font-extrabold" style={{ background: '#2F70CC', color: '#fff' }}>{copy.cta}</span>
          <p className="text-[11px] mt-2.5" style={{ color: '#68717b' }}>{FOOTER_TEXT(club)} <u>Unsubscribe</u></p>
        </div>
        <p className="text-[12.5px] font-bold mt-3" style={{ color: 'var(--text-primary)' }}>This is the only reminder. Nobody is reminded twice, and anyone who unsubscribed is left out.</p>
        <label className="flex gap-3 items-start rounded-2xl px-4 py-3 mt-3 cursor-pointer" style={{ background: 'rgba(245,184,75,0.1)', border: '1px solid rgba(245,184,75,0.5)' }}>
          <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} data-testid="reminder-confirm" className="mt-0.5 w-5 h-5 shrink-0" />
          <span className="text-[12.5px] font-bold leading-snug" style={{ color: 'var(--text-primary)' }}>I confirm these people gave {club} their details, and we&apos;re allowed to contact them about the club.</span>
        </label>
        {!emailReady && <p role="alert" className="text-[13px] mt-3" style={{ color: 'var(--brand-crimson)' }}>Email isn&apos;t set up on PadelMate yet, so nothing can be sent.</p>}
        {error && <p role="alert" className="text-[13px] mt-3" style={{ color: 'var(--brand-crimson)' }}>{error}</p>}
        <button type="button" onClick={send} disabled={!confirmed || busy || !emailReady} data-testid="reminder-send" className="w-full rounded-full py-3.5 text-[15px] font-black mt-4" style={{ background: '#d4f53c', color: '#17240a', opacity: !confirmed || busy || !emailReady ? 0.55 : 1, minHeight: 50 }}>
          {busy ? 'Sending…' : `Send ${count} ${count === 1 ? 'reminder' : 'reminders'}`}
        </button>
      </div>
    </div>
  )
}
