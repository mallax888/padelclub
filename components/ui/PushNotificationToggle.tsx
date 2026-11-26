'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Smartphone } from 'lucide-react'
import { readPushSupport, subscribeToPush, unsubscribeFromPush } from '@/lib/push-client'

export default function PushNotificationToggle({ variant = 'icon' }: { variant?: 'icon' | 'row' }) {
  const [supported, setSupported] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    readPushSupport().then(support => {
      setSupported(support.state === 'available' || support.state === 'subscribed')
      setEnabled(support.state === 'subscribed')
    })
  }, [])

  const enable = async () => {
    setLoading(true)
    const result = await subscribeToPush()
    setLoading(false)
    if (result === 'subscribed') {
      setEnabled(true)
      toast.success('Push notifications enabled!')
    } else if (result === 'unconfigured') {
      toast.error('Push notifications are not set up for this deployment yet')
    } else if (result === 'denied') {
      toast.error('Notifications permission denied')
    } else {
      toast.error('Could not enable push notifications')
    }
  }

  const disable = async () => {
    setLoading(true)
    const ok = await unsubscribeFromPush()
    setLoading(false)
    if (ok) {
      setEnabled(false)
      toast.success('Push notifications turned off')
    } else {
      toast.error('Could not turn off push notifications')
    }
  }

  if (!supported) return null

  if (variant === 'row') return (
    <button type="button" role="switch" aria-checked={enabled} onClick={enabled ? disable : enable} disabled={loading} data-testid="push-row"
      className="flex items-center gap-2.5 w-full px-2 py-2.5 rounded-[10px] text-[13.5px] font-bold" style={{ color: 'var(--text-primary)' }}>
      <Smartphone size={16} strokeWidth={2} style={{ color: 'var(--text-muted)' }} />
      Phone alerts
      <span aria-hidden className="ml-auto relative rounded-full shrink-0" style={{ width: 40, height: 24, background: enabled ? 'var(--today-block-bg)' : 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <span className="absolute rounded-full" style={{ top: 2, left: enabled ? 18 : 2, width: 18, height: 18, background: enabled ? 'var(--today-block-fg)' : 'var(--text-subtle)', transition: 'left .15s' }} />
      </span>
    </button>
  )

  return (
    <button
      type="button"
      onClick={enabled ? disable : enable}
      disabled={loading}
      aria-label={enabled ? 'Turn off push notifications' : 'Turn on push notifications'}
      className="relative inline-flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-150 hover:bg-[var(--bg-raised)]"
      style={{ color: enabled ? 'var(--brand-primary-text)' : 'var(--text-muted)' }}
    >
      <Smartphone size={18} strokeWidth={2} />
      {!enabled && (
        <svg width="18" height="18" viewBox="0 0 24 24" style={{ position: 'absolute' }}>
          <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      )}
    </button>
  )
}
