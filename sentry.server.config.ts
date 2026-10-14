// Server-side error reporting. Everything here is inert until
// NEXT_PUBLIC_SENTRY_DSN is set in the environment, so a deployment without
// it behaves exactly as it did before -- no network calls, no overhead.
import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    // Performance tracing is the expensive part of Sentry's free tier and
    // isn't what we're here for: the point is catching the webhook and cron
    // failures nobody is watching. 10% is enough to spot a slow route.
    tracesSampleRate: 0.1,
    environment: process.env.VERCEL_ENV ?? 'development',
    // A Stripe webhook body or a Supabase row can carry a member's email and
    // name. Errors are for us to debug, not a second copy of the member
    // database, so request bodies and headers stay out of them.
    sendDefaultPii: false,
  })
}
