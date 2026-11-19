import Link from 'next/link'
import type { ReactNode } from 'react'
import { BUSINESS, LEGAL_LINKS } from '@/lib/business'

// The plain, public wrapper for Terms, Privacy, Refunds, Club terms and Contact: no sign-in needed, readable in light and dark.
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <header className="px-5 sm:px-8 py-5 flex items-center justify-between max-w-3xl mx-auto">
        <Link href="/" className="text-[13px] font-extrabold" style={{ letterSpacing: '0.18em' }}>PADEL<span style={{ color: 'var(--brand-primary-text)' }}>CLUB</span></Link>
        <Link href="/" className="text-[13px] font-bold" style={{ color: 'var(--brand-primary-text)' }}>‹ Back to PadelClub</Link>
      </header>
      <main className="px-5 sm:px-8 pb-16 max-w-3xl mx-auto">
        <h1 className="text-3xl font-semibold" style={{ borderLeft: '3px solid var(--brand-primary)', paddingLeft: 12 }}>{title}</h1>
        <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>{BUSINESS.legalName}, trading as {BUSINESS.tradingName} · Last updated {BUSINESS.lastUpdated}</p>
        <div className="mt-8 flex flex-col gap-5 text-[15px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>{children}</div>
      </main>
      <footer className="px-5 sm:px-8 py-8 max-w-3xl mx-auto" style={{ borderTop: '1px solid var(--border)' }}>
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] font-semibold" aria-label="Legal">
          {LEGAL_LINKS.map(l => <Link key={l.href} href={l.href} style={{ color: 'var(--brand-primary-text)' }}>{l.label}</Link>)}
        </nav>
        <p className="text-xs mt-3" style={{ color: 'var(--text-subtle)' }}>© {BUSINESS.legalName}. {BUSINESS.tradingName} is a trading name of {BUSINESS.legalName}, a New Zealand company.</p>
      </footer>
    </div>
  )
}

export const H2 = ({ children }: { children: ReactNode }) => <h2 className="text-xl font-semibold mt-3" style={{ color: 'var(--text-primary)' }}>{children}</h2>
export const P = ({ children }: { children: ReactNode }) => <p style={{ color: 'var(--text-muted)' }}>{children}</p>
export const UL = ({ children }: { children: ReactNode }) => <ul className="list-disc pl-6 flex flex-col gap-1.5" style={{ color: 'var(--text-muted)' }}>{children}</ul>
export const B = ({ children }: { children: ReactNode }) => <b style={{ color: 'var(--text-primary)' }}>{children}</b>
export const Note = ({ children }: { children: ReactNode }) => <div className="rounded-[20px] p-5 text-[14px]" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>{children}</div>
