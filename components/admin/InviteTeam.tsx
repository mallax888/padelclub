'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export type PendingInvite = { id: string; email: string; role: 'admin' | 'staff'; scopeLabel: string; expiresAt: string }
const card = { background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' } as const

// Invite a new team member by email. The invite link is the only way to get a club account.
export default function InviteTeam({ clubs, canGrantAll, defaultClub, invites, ready }: {
  clubs: { slug: string; name: string }[]; canGrantAll: boolean; defaultClub: string; invites: PendingInvite[]; ready: boolean
}) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'staff' | 'admin'>('staff')
  const [club, setClub] = useState(defaultClub)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<{ email: string; emailed: boolean; link: string } | null>(null)

  async function send(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null); setSent(null)
    const scope = club === '__all' ? { kind: 'all' } : { kind: 'club', venueSlug: club }
    try {
      const res = await fetch('/api/admin/team/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, role, scope }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) setError(d.error ?? 'Could not send that invite.')
      else { setSent({ email, emailed: !!d.emailed, link: d.link }); setEmail(''); router.refresh() }
    } catch { setError('Could not send that invite. Check your connection.') } finally { setBusy(false) }
  }
  async function cancel(id: string) {
    await fetch('/api/admin/team/invite/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    router.refresh()
  }

  return (
    <section className="rounded-2xl p-5 mb-5" style={card} data-testid="invite-team">
      <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Invite a team member</h2>
      <p className="text-xs mt-1 mb-4" style={{ color: 'var(--text-muted)' }}>They get an email, set a password and go straight to the club dashboard. No player sign-up.</p>
      {!ready ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Inviting by email isn&apos;t switched on yet: the database change 033 has not been run.</p>
      ) : (
        <form onSubmit={send} className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end lg:grid-cols-1 lg:items-stretch">
          <div><label className="label" htmlFor="invite-email">Their email</label><input id="invite-email" type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} required placeholder="name@yourclub.com" /></div>
          <div>
            <label className="label">Invite as</label>
            <div className="flex gap-1 rounded-lg p-1" style={{ background: 'var(--bg-raised)' }} role="group" aria-label="Invite as">
              {([['staff', 'Front desk'], ['admin', 'Owner']] as const).map(([v, l]) => (
                <button key={v} type="button" aria-pressed={role === v} data-testid={`invite-role-${v}`} onClick={() => setRole(v)} className="px-3 py-2 rounded-md text-xs font-medium"
                  style={{ background: role === v ? 'var(--brand-primary)' : 'transparent', color: role === v ? 'var(--brand-primary-on, #fff)' : 'var(--text-muted)' }}>{l}</button>
              ))}
            </div>
          </div>
          <div><label className="label" htmlFor="invite-club">Their club</label>
            <select id="invite-club" className="input" value={club} onChange={e => setClub(e.target.value)}>
              {canGrantAll && <option value="__all">All clubs</option>}
              {clubs.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select></div>
          <button type="submit" disabled={busy} className="btn-main" data-testid="invite-send">{busy ? 'Sending…' : 'Send invite'}</button>
        </form>
      )}
      <p className="text-[11.5px] mt-3" style={{ color: 'var(--text-subtle)' }}>Front desk runs the day: bookings, courts, check-ins. Money and reports stay with owners.</p>
      {error && <p role="alert" className="text-sm mt-3" style={{ color: 'var(--brand-crimson)' }} data-testid="invite-error">{error}</p>}
      {sent && (
        <div className="mt-3 text-sm rounded-xl p-3" style={{ background: 'var(--bg-raised)', color: 'var(--text-primary)' }} data-testid="invite-sent">
          {sent.emailed ? <>Invite emailed to <b>{sent.email}</b>.</> : <>We could not send the email to <b>{sent.email}</b>. Send them this link yourself (it works once):<div className="mt-2 break-all text-xs select-all" style={{ color: 'var(--brand-primary-text)' }} data-testid="invite-link">{sent.link}</div></>}
        </div>
      )}
      {invites.length > 0 && (
        <div className="mt-4" style={{ borderTop: '1px solid var(--border)' }}>
          {invites.map(i => (
            <div key={i.id} className="flex items-center justify-between gap-3 py-2.5" style={{ borderBottom: '1px solid var(--border)' }} data-testid="pending-invite">
              <div className="min-w-0"><div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{i.email}</div><div className="text-xs" style={{ color: 'var(--text-muted)' }}>{i.role === 'admin' ? 'Owner' : 'Front desk'} · {i.scopeLabel}</div></div>
              <div className="flex items-center gap-2 shrink-0"><span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,212,0,.15)', color: 'var(--brand-yellow)' }}>Invite sent</span>
                <button type="button" onClick={() => cancel(i.id)} className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }} data-testid="cancel-invite">Cancel</button></div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
