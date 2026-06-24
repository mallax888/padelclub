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
      style={{ background: 'var(--bg-base)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div style={{ fontFamily: 'Georgia,serif', fontSize: 32, fontWeight: 700, color: 'var(--text-primary)' }}>
              Padel<span style={{ color: '#39FF6E' }}>Club</span>
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
                className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all"
                style={{ background: 'var(--brand-primary)', color: 'var(--brand-primary-on)', boxShadow: 'var(--glow-primary)' }}
                disabled={loading}
              >
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          </div>
        )}

        <p className="text-center text-sm mt-4" style={{ color: 'var(--text-muted)' }}>
          <Link href="/auth/login" style={{ color: 'var(--brand-primary)' }}>← Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}
