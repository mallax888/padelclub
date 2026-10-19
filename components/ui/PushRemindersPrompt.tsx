'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { readPushSupport, subscribeToPush, type PushSupport } from '@/lib/push-client'

const DISMISSED_KEY = 'padelclub.remindersPromptDismissed'

// Asking for notification permission is a one-shot: deny it and the browser
// never shows the prompt again, on any visit. The only place it was asked
// from was a small phone icon in the navbar, which realistically nobody taps,
// so the reminders this app can already send had nowhere to go.
//
// This asks at the one moment the answer is obviously yes -- a court is
// booked and paid for -- and frames it as the reminder rather than as a
// permission.
export default function PushRemindersPrompt({ highlight = false }: {
  // Set after a payment lands back on this page. The ask is the same either
  // way; this just lets it read as part of the confirmation rather than as
  // another card on the list.
  highlight?: boolean
}) {
  const [support, setSupport] = useState<PushSupport | null>(null)
  const [dismissed, setDismissed] = useState(true)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISSED_KEY) === '1')
    } catch {
      // Private windows and blocked site data throw here. Showing the prompt
      // is the safe side of that: worst case they dismiss it again.
      setDismissed(false)
    }
    readPushSupport().then(setSupport)
  }, [])

  const close = () => {
    setDismissed(true)
    try { localStorage.setItem(DISMISSED_KEY, '1') } catch {}
  }

  const turnOn = async () => {
    setLoading(true)
    const result = await subscribeToPush()
    setLoading(false)
    if (result === 'subscribed') {
      toast.success("Done — we'll remind you 2 hours before you play")
      setSupport({ state: 'subscribed' })
      return
    }
    if (result === 'unconfigured') {
      toast.error('Reminders are not set up on this deployment yet')
      return
    }
    if (result === 'denied') {
      // Nothing more to ask: the browser won't offer again. Take the card
      // away rather than leave a button that can no longer do anything.
      toast.error('Reminders blocked — you can allow them in your browser settings')
      close()
      return
    }
    toast.error('Could not turn reminders on')
  }

  if (dismissed || !support) return null
  if (support.state === 'subscribed' || support.state === 'denied' || support.state === 'unsupported') return null

  const needsInstall = support.state === 'needs-install'

  return (
    <div
      className="rounded-2xl px-4 py-3.5 mb-5 flex items-start gap-3"
      style={{
        background: 'var(--bg-surface)',
        border: `1px solid ${highlight ? 'var(--brand-primary)' : 'var(--border)'}`,
      }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: 'var(--brand-primary-muted)', color: 'var(--brand-primary-text)' }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
          {needsInstall ? 'Add PadelClub to your home screen' : 'Never miss a court time'}
        </div>
        <div className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          {needsInstall
            ? 'Tap Share, then Add to Home Screen. Reminders only work from the installed app on iPhone.'
            : "We'll remind you 2 hours before you play, and let you know when someone pays their share."}
        </div>
        {!needsInstall && (
          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              onClick={turnOn}
              disabled={loading}
              className="text-xs font-bold px-3.5 py-2 rounded-xl whitespace-nowrap disabled:opacity-60"
              style={{ background: 'var(--brand-primary)', color: 'var(--brand-primary-on)' }}
            >
              {loading ? 'Turning on…' : 'Turn on reminders'}
            </button>
            <button
              type="button"
              onClick={close}
              className="text-xs font-semibold px-3 py-2 rounded-xl whitespace-nowrap"
              style={{ color: 'var(--text-subtle)' }}
            >
              Not now
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={close}
        aria-label="Dismiss"
        className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-xs"
        style={{ color: 'var(--text-subtle)' }}
      >
        ✕
      </button>
    </div>
  )
}
