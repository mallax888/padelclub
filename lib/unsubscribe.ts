// Server-only: the link at the bottom of every invite and reminder. Signed, so only the real link works, and the page behind
// it asks before it unsubscribes anyone (email scanners open links, they must not unsubscribe people by accident).
import { createHmac, timingSafeEqual } from 'node:crypto'

const secret = () => process.env.UNSUBSCRIBE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
// Only plain id characters; the signature, not this shape, is what proves the link is real.
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/

export const unsubSig = (id: string): string => createHmac('sha256', secret()).update('contact-unsub:' + id).digest('hex').slice(0, 32)
export function verifyUnsub(id: unknown, sig: unknown): id is string {
  if (typeof id !== 'string' || typeof sig !== 'string' || !SAFE_ID.test(id) || sig.length !== 32 || !secret()) return false
  const a = Buffer.from(unsubSig(id)), b = Buffer.from(sig)
  return a.length === b.length && timingSafeEqual(a, b)
}
export const unsubUrl = (origin: string, id: string): string => `${origin.replace(/\/$/, '')}/unsubscribe?c=${encodeURIComponent(id)}&s=${unsubSig(id)}`
// What mail apps' one-click unsubscribe POSTs to. The link in the email body goes to the page above, which asks first.
export const unsubApiUrl = (origin: string, id: string): string => `${origin.replace(/\/$/, '')}/api/unsubscribe?c=${encodeURIComponent(id)}&s=${unsubSig(id)}`
export const maskEmail = (e: string): string => { const [l, d] = e.split('@'); return d ? `${l.slice(0, 1)}${'*'.repeat(Math.max(2, Math.min(6, l.length - 1)))}@${d}` : '***' }
