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

