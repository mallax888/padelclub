'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const supabase = createClient()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Welcome back!')
      router.push('/book')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'radial-gradient(circle at 50% 0%, var(--brand-primary-muted), var(--bg-base) 60%)' }}>
      <div className="w-full max-w-sm">

        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-3">
            <svg width="56" height="56" viewBox="0 0 100 100">
              <defs>
                <radialGradient id="ball" cx="38%" cy="30%" r="65%">
                  <stop offset="0%" stopColor="#FFFF80"/>
                  <stop offset="40%" stopColor="#FFE000"/>
                  <stop offset="100%" stopColor="#AAAA00"/>
                </radialGradient>
                <filter id="fuzz">
                  <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" result="n"/>
                  <feDisplacementMap in="SourceGraphic" in2="n" scale="2" xChannelSelector="R" yChannelSelector="G"/>
                </filter>
              </defs>
              <circle cx="50" cy="50" r="46" fill="url(#ball)" filter="url(#fuzz)"/>
              <ellipse cx="38" cy="32" rx="14" ry="9" fill="white" opacity="0.25" transform="rotate(-25 38 32)"/>
              <circle cx="50" cy="50" r="46" fill="none" stroke="#AA8800" strokeWidth="1"/>
            </svg>
            <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)', userSelect: 'none' }}>
              PADEL<span style={{ color: 'var(--brand-primary)' }}>CLUB</span>
            </div>
          </div>
          <p className="text-sm font-medium tracking-wide" style={{ color: 'var(--text-muted)' }}>
            Welcome back — sign in to book your next game
          </p>
        </div>

        <div className="rounded-2xl p-6 mb-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: '0 8px 32px 0 rgba(0,0,0,0.18)' }}>
          <form onSubmit={handleLogin} className="space-y-4">
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
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  style={{ paddingRight: '2.5rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: showPassword ? 'var(--brand-primary)' : 'var(--text-subtle)' }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-3 rounded-lg text-sm font-bold transition-all"
              style={{ background: 'var(--brand-primary)', color: 'var(--brand-primary-on)', boxShadow: 'var(--glow-primary)' }}
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <div className="text-center text-sm space-y-2">
          <p style={{ color: 'var(--text-muted)' }}>
            <Link href="/auth/forgot-password" className="font-semibold hover:underline" style={{ color: 'var(--brand-primary)' }}>
              Forgot your password?
            </Link>
          </p>
          <p style={{ color: 'var(--text-muted)' }}>
            No account?{' '}
            <Link href="/auth/signup" className="font-semibold hover:underline" style={{ color: 'var(--brand-primary)' }}>
              Create one
            </Link>
          </p>
        </div>

      </div>
    </div>
  )
}
