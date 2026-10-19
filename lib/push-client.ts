// Browser-side half of push notifications, shared by the navbar toggle and
// the prompt that asks after a booking is paid for. It lived only inside
// PushNotificationToggle, which meant the prompt would have been a second
// copy of the same subscribe dance -- and the browser only ever grants
// permission once, so two implementations that disagreed would have been
// very hard to spot.

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

export type PushSupport =
  | { state: 'unsupported' }
  // iOS Safari exposes no PushManager at all until the site has been added
  // to the home screen, so there is nothing to ask for yet -- the useful
  // thing to show an iPhone is the install step, not a permission button.
  | { state: 'needs-install' }
  | { state: 'denied' }
  | { state: 'subscribed' }
  | { state: 'available' }

const isApple = () =>
  typeof navigator !== 'undefined' &&
  (/iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPadOS reports itself as a Mac; the touch points give it away.
    (/macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1))

const isInstalled = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true)

export async function readPushSupport(): Promise<PushSupport> {
  if (typeof window === 'undefined') return { state: 'unsupported' }
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return isApple() && !isInstalled() ? { state: 'needs-install' } : { state: 'unsupported' }
  }
  if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
    return { state: 'denied' }
  }
  try {
    const reg = await navigator.serviceWorker.register('/sw.js')
    const sub = await reg.pushManager.getSubscription()
    return sub ? { state: 'subscribed' } : { state: 'available' }
  } catch {
    return { state: 'unsupported' }
  }
}

export type SubscribeResult = 'subscribed' | 'denied' | 'unconfigured' | 'failed'

export async function subscribeToPush(): Promise<SubscribeResult> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!publicKey) return 'unconfigured'
  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return 'denied'
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
    if (!res.ok) return 'failed'
    return 'subscribed'
  } catch {
    return 'failed'
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
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
    return true
  } catch {
    return false
  }
}
