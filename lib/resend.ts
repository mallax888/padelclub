import { Resend } from 'resend'

let _resend: Resend | undefined

// Constructed lazily so importing this module (which Next.js does for every
// API route during build-time page-data collection) doesn't crash the build
// when RESEND_API_KEY isn't set in a given deployment's environment.
export const resend = new Proxy({} as Resend, {
  get(_target, prop, receiver) {
    if (!_resend) {
      _resend = new Resend(process.env.RESEND_API_KEY)
    }
    return Reflect.get(_resend, prop, receiver)
  },
})
