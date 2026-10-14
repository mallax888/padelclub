import * as Sentry from '@sentry/nextjs'

// Sentry catches thrown exceptions on its own, but the failures that matter
// most here are the ones the code deliberately swallows so that one member's
// problem doesn't break everyone else's: a refund that didn't go through, a
// webhook that couldn't find the booking it was paid for. Those are
// console.error today, which Sentry does not pick up, so on Vercel they land
// in a log nobody reads.
//
// Use this instead of console.error wherever the consequence is a member out
// of pocket or a club out of money. It still logs, so nothing is lost when
// Sentry isn't configured.
export function reportMoneyIssue(message: string, context?: Record<string, unknown>) {
  console.error(message, context ?? '')
  Sentry.captureException(new Error(message), {
    level: 'error',
    tags: { area: 'payments' },
    extra: context,
  })
}
