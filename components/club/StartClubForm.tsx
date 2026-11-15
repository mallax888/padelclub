'use client'
import { useState } from 'react'
import Link from 'next/link'
import ClubShell, { clubButton, clubCard } from '@/components/club/ClubShell'

const empty = { clubName: '', country: '', city: '', address: '', courts: '', phone: '', contactName: '', email: '', website: '' }

export default function StartClubForm() {
  const [f, setF] = useState(empty)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ field?: string; message: string } | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement>) => setF(p => ({ ...p, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null)
    try {
      const res = await fetch('/api/club-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) setError({ field: d.field, message: d.error ?? 'We could not send that. Please try again.' })
      else setDone(f.email)
    } catch { setError({ message: 'We could not send that. Check your connection and try again.' }) } finally { setBusy(false) }
  }

  if (done) {
    return (
      <ClubShell>
        <div className="rounded-2xl p-6" style={clubCard} data-testid="request-sent">
          <div className="w-11 h-11 rounded-full grid place-items-center text-xl font-extrabold mb-4" style={{ background: 'rgba(52,211,153,.16)', color: '#34D399' }}>✓</div>
          <h1 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Thanks, we have your request</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>We will check <b>{f.clubName}</b> and email {done} within one working day with a link to set your password.</p>
          <p className="text-sm mt-5" style={{ color: 'var(--text-subtle)' }}>Not a club? <Link href="/auth/signup" className="font-semibold" style={{ color: 'var(--brand-primary-text)' }}>Sign up as a player</Link></p>
        </div>
      </ClubShell>
    )
  }

  const field = (k: keyof typeof empty, label: string, props: any = {}) => (
    <div>
      <label className="label" htmlFor={`f-${k}`}>{label}</label>
      <input id={`f-${k}`} className="input" value={f[k]} onChange={set(k)} aria-invalid={error?.field === k} {...props} />
    </div>
  )
  return (
    <ClubShell wide>
      <div className="rounded-2xl p-6" style={clubCard}>
        <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Start your club</h1>
        <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>Tell us about your club. We check every new club and email you within one working day.</p>
        <form onSubmit={submit} className="space-y-4" noValidate>
          {field('clubName', 'Club name', { autoComplete: 'organization', required: true })}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{field('country', 'Country', { required: true })}{field('city', 'City', { required: true })}</div>
          {field('address', 'Club address')}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{field('courts', 'Number of courts', { inputMode: 'numeric' })}{field('phone', 'Your phone', { type: 'tel', autoComplete: 'tel' })}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{field('contactName', 'Your name', { autoComplete: 'name', required: true })}{field('email', 'Work email', { type: 'email', autoComplete: 'email', required: true })}</div>
          {/* A field only bots fill in. */}
          <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px' }}><label>Website<input tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} /></label></div>
          {error && <p role="alert" className="text-sm" style={{ color: 'var(--brand-crimson)' }} data-testid="request-error">{error.message}</p>}
          <button type="submit" disabled={busy} className="w-full py-3 rounded-lg text-sm font-bold disabled:opacity-60" style={clubButton}>{busy ? 'Sending…' : 'Send request'}</button>
          <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>No password yet. You set it when we approve your club.</p>
        </form>
      </div>
      <p className="text-center text-sm mt-4" style={{ color: 'var(--text-muted)' }}>
        Already on a club team? <Link href="/club/login" className="font-semibold" style={{ color: 'var(--brand-primary-text)' }}>Club log in</Link>
      </p>
    </ClubShell>
  )
}
