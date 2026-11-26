'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import Link from 'next/link'
import toast from 'react-hot-toast'

export default function ForgotPasswordPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    if (error) {
      toast.error(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'radial-gradient(circle at 50% 0%, var(--brand-primary-muted), var(--bg-base) 60%)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <svg width="56" height="56" viewBox="0 0 100 100" style={{ colorScheme: 'light' }}>
              <defs>
                <radialGradient id="ball" cx="35%" cy="28%" r="75%">
                  <stop offset="0%" stopColor="#F7FFD6"/>
                  <stop offset="40%" stopColor="#D4FF3D"/>
                  <stop offset="100%" stopColor="#8FAE1E"/>
                </radialGradient>
                <clipPath id="ballClip">
                  <circle cx="50" cy="50" r="46"/>
                </clipPath>
              </defs>
              <circle cx="50" cy="50" r="46" fill="url(#ball)"/>
              <g clipPath="url(#ballClip)">
                <path d="M 50 4 C 20 20, 20 40, 50 50 C 80 60, 80 80, 50 96" fill="none" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" transform="rotate(25 50 50)"/>
              </g>
              <ellipse cx="34" cy="28" rx="14" ry="9" fill="white" opacity="0.35" transform="rotate(-25 34 28)"/>
            </svg>
            <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)', userSelect: 'none' }}>
              PADEL<span style={{ color: 'var(--brand-primary-text)' }}>MATE</span>
            </div>
          </div>
          <p className="text-xs tracking-widest uppercase" style={{ color: 'var(--text-subtle)' }}>
            Reset your password
          </p>
        </div>

        {sent ? (
          <div className="rounded-xl p-6 text-center" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="text-3xl mb-3">📧</div>
            <div className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Check your email</div>
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
              We sent a reset link to <strong>{email}</strong>. Click the link to set a new password.
            </div>
          </div>
        ) : (
          <div className="rounded-xl p-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="label">Email address</label>
                <input
                  type="email"
                  className="input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <button
                type="submit"
                className="btn-main btn-main-lime"
                disabled={loading}
              >
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          </div>
        )}

        <p className="text-center text-sm mt-4" style={{ color: 'var(--text-muted)' }}>
          <Link href="/auth/login" style={{ color: 'var(--brand-primary-text)' }}>← Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}
