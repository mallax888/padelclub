'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'

export default function ResetPasswordPage() {
  const supabase = createClient()
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [linkFailed, setLinkFailed] = useState(false)
  const readyRef = useRef(false)

  const markReady = () => {
    readyRef.current = true
    setReady(true)
  }

  useEffect(() => {
    // Supabase's recovery link can land here two different ways depending
    // on the project's auth flow setting: the older implicit flow puts the
    // session straight in the URL hash (auto-detected, surfaces as a
    // PASSWORD_RECOVERY event / an existing session), while the newer PKCE
    // flow (the supabase-js default for browser clients) puts a one-time
    // ?code= in the query string that has to be explicitly exchanged for a
    // session -- nothing does that automatically. Without this, a PKCE
    // project's reset links would hang on "Verifying..." forever even
    // though the link itself is completely valid, because the event this
    // page was waiting for was never going to fire. Handle both.
    const code = new URLSearchParams(window.location.search).get('code')
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
        if (data.session) markReady()
        else if (error && !readyRef.current) setLinkFailed(true)
      })
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) markReady()
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        markReady()
      }
    })

    // Fallback for any other way this could still get stuck -- surface a
    // real error instead of hanging indefinitely.
    const timeout = setTimeout(() => {
      if (!readyRef.current) setLinkFailed(true)
    }, 8000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      toast.error('Passwords do not match')
      return
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Password updated! Signing you in…')
      router.push('/book')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'radial-gradient(circle at 50% 0%, var(--brand-primary-muted), var(--bg-base) 60%)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div style={{ fontFamily: 'Georgia,serif', fontSize: 32, fontWeight: 700, color: 'var(--text-primary)' }}>
            Padel<span style={{ color: 'var(--brand-primary-text)' }}>Club</span>
          </div>
          <p className="text-xs tracking-widest uppercase mt-1" style={{ color: 'var(--text-subtle)' }}>
            Set a new password
          </p>
        </div>

        {linkFailed ? (
          <div className="rounded-xl p-6 text-center" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="text-2xl mb-2">🔗</div>
            <div className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>This reset link didn't work</div>
            <div className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
              It may have expired or already been used. Request a new one below.
            </div>
            <Link href="/auth/forgot-password"
              className="inline-block w-full py-2.5 rounded-lg text-sm font-semibold transition-all"
              style={{ background: 'var(--brand-primary)', color: 'var(--brand-primary-on)', boxShadow: 'var(--glow-primary)' }}>
              Send a new reset link
            </Link>
          </div>
        ) : !ready ? (
          <div className="rounded-xl p-6 text-center" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Verifying your reset link…
            </div>
          </div>
        ) : (
          <div className="rounded-xl p-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="label">New password</label>
                <input
                  type="password"
                  className="input"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className="label">Confirm password</label>
                <input
                  type="password"
                  className="input"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all"
                style={{ background: 'var(--brand-primary)', color: 'var(--brand-primary-on)', boxShadow: 'var(--glow-primary)' }}
                disabled={loading}
              >
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
