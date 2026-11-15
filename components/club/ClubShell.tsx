import Link from 'next/link'
import type { ReactNode } from 'react'

// The frame shared by the club-side entry pages (start a club, club log in, accept an invite).
export default function ClubShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: 'var(--bg-base)' }}>
      <div className={`w-full ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
        <div className="mb-6 text-center">
          <Link href="/" className="text-sm font-extrabold tracking-[0.14em]" style={{ color: 'var(--text-primary)' }}>
            PADEL<span style={{ color: 'var(--brand-primary-text)' }}>CLUB</span>
            <span className="ml-2 text-xs font-medium tracking-normal" style={{ color: 'var(--text-subtle)' }}>for clubs</span>
          </Link>
        </div>
        {children}
      </div>
    </div>
  )
}

export const clubCard = { background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' } as const
export const clubButton = { background: 'var(--brand-yellow)', color: '#1b1f24' } as const
