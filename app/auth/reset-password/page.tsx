'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export default function ResetPasswordPage() {
  const supabase = createClient()
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Exchange the hash tokens from the reset email for a valid session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })
    return () => subscription.unsubscribe()
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
      style={{ background: 'var(--bg-base)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div style={{ fontFamily: 'Georgia,serif', fontSize: 32, fontWeight: 700, color: 'var(--text-primary)' }}>
            Padel<span style={{ color: '#39FF6E' }}>Club</span>
          </div>
          <p className="text-xs tracking-widest uppercase mt-1" style={{ color: 'var(--text-subtle)' }}>
            Set a new password
          </p>
        </div>

        {!ready ? (
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
