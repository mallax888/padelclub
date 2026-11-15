'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import ClubShell, { clubButton, clubCard } from '@/components/club/ClubShell'

export default function JoinForm({ token, email, role, where }: { token: string; email: string; role: string; where: string }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null)
    if (password.length < 8) { setError('Choose a password of at least 8 characters.'); return }
    if (password !== confirm) { setError('The two passwords do not match.'); return }
    setBusy(true)
    const res = await fetch('/api/club/accept-invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password, fullName: name }) })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setError(d.error ?? 'Something went wrong. Please try again.'); setBusy(false); return }
    const { error: signInError } = await createClient().auth.signInWithPassword({ email, password })
    if (signInError) { router.push('/club/login'); return }
    router.push('/'); router.refresh()
  }

  return (
    <ClubShell>
      <div className="rounded-2xl p-6" style={clubCard}>
        <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Welcome to PadelClub</h1>
        <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>You are joining as <b style={{ color: 'var(--text-primary)' }} data-testid="join-role">{role}</b> ({where}).</p>
        <form onSubmit={submit} className="space-y-4">
          <div><label className="label">Email</label><input className="input" value={email} disabled readOnly /></div>
          <div><label className="label" htmlFor="join-name">Your name</label><input id="join-name" className="input" value={name} onChange={e => setName(e.target.value)} autoComplete="name" /></div>
          <div><label className="label" htmlFor="join-pw">Choose a password</label><input id="join-pw" type="password" className="input" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" required /></div>
          <div><label className="label" htmlFor="join-pw2">Confirm password</label><input id="join-pw2" type="password" className="input" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" required /></div>
          {error && <p role="alert" className="text-sm" style={{ color: 'var(--brand-crimson)' }} data-testid="join-error">{error}</p>}
          <button type="submit" disabled={busy} className="w-full py-3 rounded-lg text-sm font-bold disabled:opacity-60" style={clubButton}>{busy ? 'Setting up…' : 'Open the club dashboard'}</button>
          <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>This is a club login. It does not show player screens.</p>
        </form>
      </div>
    </ClubShell>
  )
}
