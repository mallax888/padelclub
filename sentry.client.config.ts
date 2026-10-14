// Browser-side error reporting. Inert unless NEXT_PUBLIC_SENTRY_DSN is set.
import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    // Performance tracing is the expensive part of Sentry's free tier and
    // isn't the point here: this exists to catch the webhook, cron and
    // booking failures nobody is currently watching. 10% is enough to notice
    // a route that has become slow.
    tracesSampleRate: 0.1,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? 'development',
    // Session Replay is deliberately left out. It is the most useful thing
    // Sentry offers for a misbehaving UI, but it is also roughly 100kB on
    // every page -- a real cost on a phone on mobile data, which is how most
    // of this app is used -- and it does nothing for the server-side payment
    // failures that are the reason for adding Sentry at all. Worth revisiting
    // if a UI bug ever proves impossible to reproduce.
    //
    // A Stripe webhook body or a Supabase row can carry a member's email and
    // name. Errors are for debugging, not a second copy of the member
    // database, so request bodies and headers stay out of them.
    sendDefaultPii: false,
  })
}
