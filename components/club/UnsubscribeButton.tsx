'use client'
import { useState } from 'react'

export default function UnsubscribeButton({ contactId, sig }: { contactId: string; sig: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const go = async () => {
    setState('busy')
    try {
      const res = await fetch(`/api/unsubscribe?c=${encodeURIComponent(contactId)}&s=${encodeURIComponent(sig)}`, { method: 'POST' })
      setState(res.ok ? 'done' : 'error')
    } catch { setState('error') }
  }
  if (state === 'done') return <p data-testid="unsub-done" className="text-[15px] font-bold" style={{ color: 'var(--text-primary)' }}>You are unsubscribed. We will not email you again.</p>
  return (
    <div>
      <button type="button" onClick={go} disabled={state === 'busy'} data-testid="unsub-confirm" className="btn btn-primary">{state === 'busy' ? 'Unsubscribing…' : 'Unsubscribe me'}</button>
      {state === 'error' && <p role="alert" className="text-[13px] mt-3" style={{ color: 'var(--brand-crimson)' }}>That did not work. Please try again.</p>}
    </div>
  )
}
