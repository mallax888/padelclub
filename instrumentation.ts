// Next.js calls this once per runtime at startup. It is how the server and
// edge Sentry configs get loaded; both are no-ops without a DSN.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

// Next calls onRequestError for errors thrown in server components. Next 14
// doesn't have that hook -- it arrives in 15 -- so this does nothing today
// and starts working on its own when the framework is upgraded. Server-side
// errors still reach Sentry through the SDK's route instrumentation; this
// only adds the request context around them.
export { captureRequestError as onRequestError } from '@sentry/nextjs'
