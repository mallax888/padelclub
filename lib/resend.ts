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

// onboarding@resend.dev is Resend's sandbox sender. It only delivers to the
// address that owns the Resend account, so in production every confirmation,
// reminder and refund notice silently reaches nobody: Resend accepts the send
// and returns success, the mail just never arrives.
//
// Going live is therefore an environment variable rather than a deploy --
// verify a domain in Resend, add its DNS records, then set RESEND_FROM to
// something like "PadelClub <bookings@padelclub.nz>".
const SANDBOX_FROM = 'PadelClub <onboarding@resend.dev>'

export function emailFrom(): string {
  const configured = process.env.RESEND_FROM?.trim()
  if (configured) return configured
  if (process.env.VERCEL_ENV === 'production') {
    console.error(
      'RESEND_FROM is not set, so mail is going out from the Resend sandbox address and ' +
      'members will not receive it. Verify a domain in Resend and set RESEND_FROM.',
    )
  }
  return SANDBOX_FROM
}
