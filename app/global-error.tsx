'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

// Replaces the root layout entirely when a render error escapes every other
// boundary, so it has to bring its own <html> and <body> and can't use the
// theme provider -- hence the inline media query rather than theme tokens.
// Before this existed, the same situation produced Next.js's default blank
// error page and no record anywhere that it had happened.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <style>{`
          :root { color-scheme: light dark; --bg: #EEF3F1; --fg: #0B1F17; --muted: #3F5850; --accent: #008A99; --on-accent: #FFFFFF; }
          @media (prefers-color-scheme: dark) {
            :root { --bg: #050C11; --fg: #F5FAF8; --muted: #9BB0BC; --accent: #D4FF3D; --on-accent: #10230A; }
          }
          body { background: var(--bg); color: var(--fg); }
        `}</style>
        <main style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, textAlign: 'center',
        }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Something went wrong</h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, margin: 0, maxWidth: 380, color: 'var(--muted)' }}>
            Your bookings and payments are safe. Reloading usually sorts it — if it keeps
            happening, get in touch and we&apos;ll take a look.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 6, padding: '11px 22px', borderRadius: 11, border: 'none',
              background: 'var(--accent)', color: 'var(--on-accent)',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Reload
          </button>
          {error.digest && (
            <code style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{error.digest}</code>
          )}
        </main>
      </body>
    </html>
  )
}
