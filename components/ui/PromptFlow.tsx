'use client'

import type { ReactNode } from 'react'
import { FLOW_FRAME } from '@/lib/flow-frame'

export { FLOW_FRAME }

// The pieces of a "one question at a time" page, the same look as Book a court and Club
// Setup: a progress bar, answered rows that fold up with a Change link, one open question
// card, and dimmed rows for what is still to come. The form decides which question is open;
// these only draw it.

const card = { background: 'var(--bg-surface)', border: '1px solid var(--border)' } as const

export function FlowProgress({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex gap-1.5 mb-5" data-testid="flow-progress" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="h-1 flex-1 rounded-full transition-all"
          style={{ background: i < current ? 'var(--brand-primary)' : 'rgba(128,128,128,0.35)' }} />
      ))}
    </div>
  )
}

export function AnsweredRow({ id, label, value, onChange }: { id: string; label: string; value: ReactNode; onChange?: () => void }) {
  return (
    <div className="flex items-center gap-3.5 rounded-[20px] px-4 py-3.5" data-testid={`answered-${id}`} style={card}>
      <span className="flex items-center justify-center rounded-full shrink-0 text-[13px] font-extrabold" style={{ width: 26, height: 26, background: 'var(--brand-primary-muted)', color: 'var(--brand-primary-text)' }} aria-hidden>✓</span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-extrabold uppercase" style={{ letterSpacing: '0.1em', color: 'var(--text-subtle)' }}>{label}</div>
        <div className="text-[15px] font-bold sm:truncate" style={{ color: 'var(--text-primary)' }}>{value}</div>
      </div>
      {onChange && <button type="button" onClick={onChange} className="text-[13px] font-bold shrink-0" style={{ color: 'var(--link-change)' }} aria-label={`Change ${label}`}>Change</button>}
    </div>
  )
}

export function AskCard({ n, total, title, subtitle, children }: { n: number; total: number; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="rounded-[20px] p-5 sm:p-6 animate-fade-in" data-testid="open-question" style={{ ...card, border: '1.5px solid var(--brand-primary)', boxShadow: '0 0 0 4px var(--brand-primary-muted)' }}>
      <div className="text-[11px] font-extrabold uppercase" style={{ letterSpacing: '0.1em', color: 'var(--brand-primary-text)' }}>Question {n} of {total}</div>
      <h2 className="text-xl font-extrabold mt-0.5" style={{ color: 'var(--text-primary)' }}>{title}</h2>
      {subtitle && <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>}
      <div className="flex flex-col gap-4 mt-4">{children}</div>
    </div>
  )
}

export function LaterRow({ id, label }: { id: string; label: string }) {
  return (
    <div className="flex items-center gap-3.5 rounded-[20px] px-4 py-3.5 text-[14px] font-bold" data-testid={`later-${id}`} style={{ border: '1px dashed var(--border)', color: 'var(--text-subtle)' }}>
      <span className="rounded-full shrink-0" style={{ width: 26, height: 26, border: '1.5px dashed var(--border)' }} aria-hidden />
      {label}
    </div>
  )
}

// The full-width button that moves to the next question or finishes the page.
export function FlowButton({ children, onClick, disabled, testId }: { children: ReactNode; onClick: () => void; disabled?: boolean; testId?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} data-testid={testId} className="btn-main">
      {children}
    </button>
  )
}
