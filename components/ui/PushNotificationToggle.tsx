'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import toast from 'react-hot-toast'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

export default function PushNotificationToggle() {
  const supabase = createClient()
  const [supported, setSupported] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const check = async () => {
      if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return
      setSupported(true)
      try {
        const reg = await navigator.serviceWorker.register('/sw.js')
        const sub = await reg.pushManager.getSubscription()
        setEnabled(!!sub)
      } catch {
        setSupported(false)
      }
    }
    check()
  }, [])

  const enable = async () => {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!publicKey) {
      toast.error('Push notifications are not set up for this deployment yet')
      return
    }
    setLoading(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        toast.error('Notifications permission denied')
        setLoading(false)
        return
      }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })
      const json = sub.toJSON()
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      })
      if (!res.ok) throw new Error('Failed to save subscription')
      setEnabled(true)
      toast.success('Push notifications enabled!')
    } catch {
      toast.error('Could not enable push notifications')
    }
    setLoading(false)
  }

  const disable = async () => {
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setEnabled(false)
      toast.success('Push notifications turned off')
    } catch {
      toast.error('Could not turn off push notifications')
    }
    setLoading(false)
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
      {enabled ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-9.33-5M18 8a6 6 0 0 1 6 6v3a4 4 0 0 0 2 3H2a4 4 0 0 0 2-3v-3a6 6 0 0 1 1-3.32"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
      )}
    </button>
  )
}
