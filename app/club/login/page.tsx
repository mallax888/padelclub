'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import ClubShell, { clubCard } from '@/components/club/ClubShell'

// The club-side log in. Only club accounts (owner, front desk) get through: a player who
// lands here is signed straight back out and pointed at the player log in.
export default function ClubLogin() {
  const supabase = createClient()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wrongDoor, setWrongDoor] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null); setWrongDoor(false)
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err || !data?.user) { setError(err?.message ?? 'Could not sign in.'); setBusy(false); return }
    const { data: p } = await supabase.from('profiles').select('role').eq('id', data.user.id).single()
    if (!p || !['staff', 'admin'].includes((p as any).role)) {
      await supabase.auth.signOut(); setWrongDoor(true); setBusy(false); return
    }
    router.push('/'); router.refresh()
  }

  return (
    <ClubShell>
      <div className="rounded-2xl p-6" style={clubCard}>
        <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Club log in</h1>
        <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>For owners and front desk teams.</p>
        <form onSubmit={submit} className="space-y-4">
          <div><label className="label" htmlFor="club-email">Email address</label><input id="club-email" type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></div>
          <div><label className="label" htmlFor="club-password">Password</label><input id="club-password" type="password" className="input" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" /></div>
          {error && <p role="alert" className="text-sm" style={{ color: 'var(--brand-crimson)' }}>{error}</p>}
          {wrongDoor && (
            <p role="alert" className="text-sm" style={{ color: 'var(--brand-crimson)' }} data-testid="wrong-door">
              That is a player account, so it cannot open the club dashboard. Players log in <Link href="/auth/login" className="font-semibold underline">here</Link>.
            </p>
          )}
          <button type="submit" disabled={busy} className="btn-main">{busy ? 'Signing in…' : 'Log in'}</button>
        </form>
      </div>
      <div className="text-center text-sm mt-4 space-y-1" style={{ color: 'var(--text-muted)' }}>
        <p><Link href="/auth/forgot-password" className="font-semibold" style={{ color: 'var(--brand-primary-text)' }}>Forgot your password?</Link></p>
        <p>Running a club that is not here yet? <Link href="/club" className="font-semibold" style={{ color: 'var(--brand-primary-text)' }}>Start a club</Link></p>
      </div>
    </ClubShell>
  )
}
