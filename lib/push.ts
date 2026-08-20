import webpush from 'web-push'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Configured lazily (not at module load) so importing this file -- which
// Next.js does for every route during build-time page-data collection --
// doesn't crash the build in a deployment where the VAPID env vars aren't
// set yet.
let configured: boolean | null = null
function isConfigured(): boolean {
  if (configured !== null) return configured
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) {
    configured = false
    return false
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@padelclub.example',
    publicKey,
    privateKey
  )
  configured = true
  return true
}

export type PushPayload = { title: string; body: string; url?: string }

type Subscription = { id: string; endpoint: string; p256dh: string; auth: string }

async function sendToSubscriptions(admin: SupabaseClient<Database>, subs: Subscription[], payload: PushPayload) {
  await Promise.all(subs.map(async sub => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      )
    } catch (err: any) {
      // 404/410 means the browser has permanently invalidated this
      // subscription (uninstalled, permission revoked, etc.) -- stop
      // trying to send to it.
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await admin.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
  }))
}

export async function sendPushToUser(admin: SupabaseClient<Database>, userId: string, payload: PushPayload) {
  if (!isConfigured()) return
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)
  if (!subs || subs.length === 0) return
  await sendToSubscriptions(admin, subs, payload)
}
