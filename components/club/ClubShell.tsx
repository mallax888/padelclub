import Link from 'next/link'
import type { ReactNode } from 'react'

// The frame shared by the club-side entry pages (start a club, club log in, accept an invite).
export default function ClubShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{ background: 'radial-gradient(circle at 50% 0%, var(--brand-primary-muted), var(--bg-base) 60%)' }}>
      <div className={`w-full ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
        <div className="mb-6 text-center">
          <Link href="/" className="inline-flex items-center justify-center gap-2.5" aria-label="PadelMate for clubs">
            <svg width="36" height="36" viewBox="0 0 100 100" style={{ colorScheme: 'light' }} aria-hidden>
              <defs>
                <radialGradient id="clubBall" cx="35%" cy="28%" r="75%">
                  <stop offset="0%" stopColor="#F7FFD6"/><stop offset="40%" stopColor="#D4FF3D"/><stop offset="100%" stopColor="#8FAE1E"/>
                </radialGradient>
                <clipPath id="clubBallClip"><circle cx="50" cy="50" r="46"/></clipPath>
              </defs>
              <circle cx="50" cy="50" r="46" fill="url(#clubBall)"/>
              <g clipPath="url(#clubBallClip)"><path d="M 50 4 C 20 20, 20 40, 50 50 C 80 60, 80 80, 50 96" fill="none" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" transform="rotate(25 50 50)"/></g>
              <ellipse cx="34" cy="28" rx="14" ry="9" fill="white" opacity="0.35" transform="rotate(-25 34 28)"/>
            </svg>
            <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              PADEL<span style={{ color: 'var(--brand-primary-text)' }}>MATE</span>
            </span>
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-subtle)' }}>for clubs</span>
          </Link>
        </div>
        {children}
      </div>
    </div>
  )
}

export const clubCard = { background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' } as const
