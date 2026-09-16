import Stripe from 'stripe'

let _stripe: Stripe | undefined

// Constructed lazily so importing this module (which Next.js does for every
// API route during build-time page-data collection) doesn't crash the build
// when STRIPE_SECRET_KEY isn't set in a given deployment's environment.
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    if (!_stripe) {
      _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2026-06-24.dahlia',
      })
    }
    return Reflect.get(_stripe, prop, receiver)
  },
})

// Receipt links used to hardcode dashboard.stripe.com/test/payments/..., which
// works right up until the live keys go in and then silently sends everyone
// following a receipt to a page that can't find their payment. Derived from
// the key instead, so going live needs no code change.
//
// Server-only: STRIPE_SECRET_KEY must never reach the browser, so a page
// passes the result of this down to a client component rather than calling
// it there.
export function stripeDashboardBase(): string {
  const live = process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_')
  return `https://dashboard.stripe.com/${live ? '' : 'test/'}payments`
}

