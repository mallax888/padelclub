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
    <div className="min-h-screen flex items-center justify-center bg-[#222] px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          {/* Tennis ball SVG */}
          <div className="flex items-center justify-center gap-3 mb-2">
            <svg width="44" height="44" viewBox="0 0 100 100">
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
            <div style={{fontFamily:'Georgia,serif',fontSize:32,fontWeight:700,color:'#fff'}}>
              Padel<span style={{color:'#00FF87'}}>Club</span>
            </div>
          </div>
          <p className="text-xs text-gray-500 tracking-widest uppercase">Sign in to your account</p>
        </div>

        <div className="card">
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
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary w-full justify-center"
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          No account?{' '}
          <Link href="/auth/signup" className="hover:underline font-medium" style={{color:'#00FF87'}}>
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}