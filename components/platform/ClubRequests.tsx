'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export type ClubRequest = {
  id: string; clubName: string; country: string; city: string; address: string | null; courts: number | null; phone: string | null
  contactName: string; email: string; status: 'pending' | 'approved' | 'declined'; venueSlug: string | null; createdAt: string; suggestedSlug: string
}
const card = { background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' } as const

export default function ClubRequests({ requests, venues }: { requests: ClubRequest[]; venues: { slug: string; name: string }[] }) {
  const router = useRouter()
  const waiting = requests.filter(r => r.status === 'pending')
  const decided = requests.filter(r => r.status !== 'pending')
  return (
    <div data-testid="club-requests">
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Club requests</h1>
        {waiting.length > 0 && <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(255,212,0,.15)', color: 'var(--brand-yellow)' }} data-testid="waiting-count">{waiting.length} waiting</span>}
      </div>
      {waiting.length === 0 && <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }} data-testid="none-waiting">No requests waiting.</p>}
      <div className="space-y-3">{waiting.map(r => <Row key={r.id} r={r} venues={venues} onDone={() => router.refresh()} />)}</div>
      {decided.length > 0 && (
        <>
          <h2 className="text-sm font-semibold mt-8 mb-2" style={{ color: 'var(--text-muted)' }}>Decided</h2>
          <div className="rounded-2xl overflow-hidden" style={card}>
            {decided.map(r => (
              <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm" style={{ borderBottom: '1px solid var(--border)' }} data-testid="decided-row">
                <div className="min-w-0"><div className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{r.clubName}</div><div className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.contactName} · {r.email}</div></div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: r.status === 'approved' ? 'rgba(52,211,153,.16)' : 'var(--bg-raised)', color: r.status === 'approved' ? '#34D399' : 'var(--text-muted)' }}>{r.status === 'approved' ? 'Approved' : 'Declined'}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function Row({ r, venues, onDone }: { r: ClubRequest; venues: { slug: string; name: string }[]; onDone: () => void }) {
  const [slug, setSlug] = useState(r.suggestedSlug)
  const [busy, setBusy] = useState<'approve' | 'decline' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [link, setLink] = useState<string | null>(null)
  async function act(action: 'approve' | 'decline') {
    setBusy(action); setError(null)
    try {
      const res = await fetch('/api/platform/club-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id, action, venueSlug: slug }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) setError(d.error ?? 'Something went wrong.')
      else if (action === 'approve' && !d.emailed) setLink(d.link)
      else onDone()
    } catch { setError('Something went wrong. Check your connection.') } finally { setBusy(null) }
  }
  return (
    <div className="rounded-2xl p-4" style={card} data-testid="request-row">
      <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{r.clubName} <span className="font-normal" style={{ color: 'var(--text-muted)' }}>· {r.city}, {r.country}</span></div>
      <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{r.contactName} · {r.email}{r.phone ? ` · ${r.phone}` : ''}{r.courts ? ` · ${r.courts} courts` : ''} · asked {new Date(r.createdAt).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}</div>
      {r.address && <div className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>{r.address}</div>}
      {link ? (
        <div className="mt-3 text-sm rounded-xl p-3" style={{ background: 'var(--bg-raised)', color: 'var(--text-primary)' }} data-testid="approve-link">
          Approved. We could not send the email, so send {r.email} this link (it works once):
          <div className="mt-2 break-all text-xs select-all" style={{ color: 'var(--brand-primary-text)' }}>{link}</div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor={`club-${r.id}`}>Which club is this</label>
          <select id={`club-${r.id}`} className="input" style={{ maxWidth: 260 }} value={slug} onChange={e => setSlug(e.target.value)} data-testid="pick-club">
            <option value="">Which club is this?</option>
            {venues.map(v => <option key={v.slug} value={v.slug}>{v.name}</option>)}
          </select>
          <button type="button" disabled={busy !== null || !slug} onClick={() => act('approve')} className="px-3 py-2 rounded-lg text-xs font-bold disabled:opacity-50" style={{ background: 'var(--brand-primary)', color: 'var(--brand-primary-on, #fff)' }} data-testid="approve">{busy === 'approve' ? 'Approving…' : 'Approve and email'}</button>
          <button type="button" disabled={busy !== null} onClick={() => act('decline')} className="px-3 py-2 rounded-lg text-xs font-bold disabled:opacity-50" style={{ background: 'var(--bg-raised)', color: 'var(--text-muted)' }} data-testid="decline">Decline</button>
        </div>
      )}
      {error && <p role="alert" className="text-xs mt-2" style={{ color: 'var(--brand-crimson)' }} data-testid="request-action-error">{error}</p>}
    </div>
  )
}
