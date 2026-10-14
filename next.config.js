/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required on Next 14 for instrumentation.ts to run, which is what loads
  // the server and edge Sentry configs. Harmless when Sentry is switched off.
  experimental: { instrumentationHook: true },
}

// Error reporting is opt-in: with no NEXT_PUBLIC_SENTRY_DSN there is no
// wrapper and the build is exactly what it was before. Adding Sentry
// therefore can't change how production builds behave until someone
// deliberately turns it on, and turning it off again is one environment
// variable rather than a revert.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (!dsn) {
  module.exports = nextConfig
} else {
  const { withSentryConfig } = require('@sentry/nextjs')
  module.exports = withSentryConfig(nextConfig, {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    // Readable stack traces need source maps uploaded at build time, which
    // needs an auth token. Without one, skip the upload rather than fail the
    // build — errors still arrive, just minified.
    sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
    silent: true,
    // Routes Sentry's own requests through our own domain, so an ad blocker
    // doesn't quietly swallow the error reports we added Sentry to see.
    tunnelRoute: '/monitoring',
    disableLogger: true,
  })
}
