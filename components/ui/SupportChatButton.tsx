'use client'

declare global {
  interface Window {
    Tawk_API?: { toggle?: () => void }
  }
}

export default function SupportChatButton() {
  return (
    <button
      onClick={() => window.Tawk_API?.toggle?.()}
      aria-label="Open support chat"
      className="hidden md:flex fixed items-center justify-center rounded-full"
      style={{
        right: 24,
        bottom: 24,
        width: 52,
        height: 52,
        zIndex: 45,
        background: 'var(--brand-primary)',
        color: 'var(--brand-primary-on)',
        boxShadow: 'var(--glow-primary)',
        border: '1px solid var(--brand-primary)',
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
      </svg>
    </button>
  )
}
