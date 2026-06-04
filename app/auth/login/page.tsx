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
          <div className="flex justify-center mb-4">
            <svg width="64" height="64" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="30" fill="#FFE000" stroke="#E6C800" strokeWidth="1.5"/>
              <path d="M32 2 Q48 16 48 32 Q48 48 32 62" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" opacity="0.6"/>
              <path d="M32 2 Q16 16 16 32 Q16 48 32 62" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" opacity="0.6"/>
              <circle cx="32" cy="32" r="30" fill="none" stroke="#E6C800" strokeWidth="1.5"/>
            </svg>
          </div>
          <div className="mb-1" style={{fontFamily:'Georgia,serif',fontSize:32,fontWeight:700,letterSpacing:'-0.5px',color:'#fff'}}>
            Padel<span style={{color:'#00FF87'}}>Club</span>
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