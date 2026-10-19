'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Smartphone } from 'lucide-react'
import { readPushSupport, subscribeToPush, unsubscribeFromPush } from '@/lib/push-client'

export default function PushNotificationToggle() {
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
