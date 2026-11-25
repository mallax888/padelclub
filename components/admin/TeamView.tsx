'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { getInitials } from '@/lib/utils'
import { copyText } from '@/lib/copy-text'
import type { TeamScope } from '@/lib/team'
import type { PendingInvite } from './InviteTeam'

const display = { fontFamily: 'var(--font-display), Manrope, sans-serif' } as const
const card = { background: 'var(--bg-surface)', border: '1px solid var(--border)' } as const
const sectionLabel = { letterSpacing: '0.14em', color: 'var(--text-subtle)' } as const

type Role = 'admin' | 'staff'
type Member = { id: string; name: string; email: string; role: Role; scope: TeamScope; scopeLabel: string; isMe: boolean }
type Club = { slug: string; name: string }
type Found = { id: string; name: string; email: string; role: string; isMe: boolean }

const ROLE_TEXT: Record<Role, { title: string; text: string; pill: string }> = {
  admin: { title: 'Owner', text: 'Everything, including money and settings', pill: 'Owner' },
  staff: { title: 'Front desk', text: 'Runs the day. No money, no settings', pill: 'Front desk' },
}

function Radio({ selected }: { selected: boolean }) {
  return (
    <span aria-hidden className="ml-auto shrink-0 rounded-full"
      style={{ width: 22, height: 22, border: `2px solid ${selected ? 'var(--brand-primary)' : 'var(--text-subtle)'}`, background: selected ? 'radial-gradient(circle, var(--brand-primary) 0 45%, transparent 50%)' : 'transparent' }} />
  )
}

function Option({ selected, onClick, title, text, children }: { selected: boolean; onClick: () => void; title: string; text?: string; children?: React.ReactNode }) {
  return (
    <div role="radio" aria-checked={selected} tabIndex={0} onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      className="rounded-[14px] px-3.5 py-3 mt-2 cursor-pointer"
      style={{ minHeight: 64, background: selected ? 'var(--brand-primary-muted)' : 'var(--bg-raised)', border: `1px solid ${selected ? 'var(--brand-primary)' : 'var(--border)'}` }}>
      <div className="flex items-center gap-3">
        <div className="min-w-0">
          <div className="text-sm font-extrabold" style={{ color: 'var(--text-primary)' }}>{title}</div>
          {text && <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{text}</div>}
        </div>
        <Radio selected={selected} />
      </div>
      {children}
    </div>
  )
}

function Sheet({ title, onClose, children }: { title: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0" style={{ background: 'rgba(10,12,15,0.55)' }} onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[92vh] overflow-y-auto rounded-t-[26px] md:rounded-[26px] px-4 pt-3.5"
        style={{ ...card, paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>
        <div className="mx-auto mb-3.5 md:hidden" style={{ width: 42, height: 4, borderRadius: 4, background: 'var(--text-subtle)', opacity: 0.6 }} />
        <div className="text-[19px] font-extrabold" style={{ ...display, color: 'var(--text-primary)' }}>{title}</div>
        {children}
      </div>
    </div>
  )
}

const Label = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[11px] font-extrabold uppercase mt-4 mb-1 px-0.5" style={sectionLabel}>{children}</div>
)

// Who the person covers: one club, a whole country, or everything -- only the
// choices the current owner may themselves give.
function ScopePicker({ scope, setScope, clubs, countries, canGrantAll }: {
  scope: TeamScope; setScope: (s: TeamScope) => void; clubs: Club[]; countries: string[]; canGrantAll: boolean
}) {
  const clubSel = scope.kind === 'club' ? scope.venueSlug : clubs[0]?.slug ?? ''
  const countrySel = scope.kind === 'country' ? scope.country : countries[0] ?? ''
  const selectStyle = { minHeight: 44, background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' } as const
  return (
    <div role="radiogroup" aria-label="Which clubs">
      <Option selected={scope.kind === 'club'} onClick={() => setScope({ kind: 'club', venueSlug: clubSel })} title="One club" text="Only the club chosen below">
        {scope.kind === 'club' && (
          <select aria-label="Club" value={clubSel} onClick={e => e.stopPropagation()} onChange={e => setScope({ kind: 'club', venueSlug: e.target.value })}
            className="w-full rounded-xl px-3 mt-2.5 text-sm font-semibold" style={selectStyle}>
            {clubs.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
        )}
      </Option>
      {countries.length > 0 && (
        <Option selected={scope.kind === 'country'} onClick={() => setScope({ kind: 'country', country: countrySel })} title="All clubs in a country" text="Every club in the country chosen below">
          {scope.kind === 'country' && (
            <select aria-label="Country" value={countrySel} onClick={e => e.stopPropagation()} onChange={e => setScope({ kind: 'country', country: e.target.value })}
              className="w-full rounded-xl px-3 mt-2.5 text-sm font-semibold" style={selectStyle}>
              {countries.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </Option>
      )}
      {canGrantAll && <Option selected={scope.kind === 'all'} onClick={() => setScope({ kind: 'all' })} title="All clubs" text="Every club on PadelMate" />}
    </div>
  )
}

const RolePicker = ({ role, setRole }: { role: Role; setRole: (r: Role) => void }) => (
  <div role="radiogroup" aria-label="Their role">
    {(['admin', 'staff'] as const).map(r => <Option key={r} selected={role === r} onClick={() => setRole(r)} title={ROLE_TEXT[r].title} text={ROLE_TEXT[r].text} />)}
  </div>
)

async function send(body: object): Promise<string | null> {
  try {
    const res = await fetch('/api/admin/team', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({}))
    return res.ok ? null : (data.error ?? 'Could not save that change.')
  } catch {
    return 'Could not save that change. Check your connection and try again.'
  }
}

export default function TeamView({ members, clubs, countries, canGrantAll, defaultClub, invites, aside }: {
  members: Member[]; clubs: Club[]; countries: string[]; canGrantAll: boolean; defaultClub: string; invites: PendingInvite[]; aside: React.ReactNode
}) {
  const router = useRouter()
  const defaultScope: TeamScope = clubs.length > 0 ? { kind: 'club', venueSlug: defaultClub } : canGrantAll ? { kind: 'all' } : { kind: 'country', country: countries[0] ?? '' }

  // add
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Found[]>([])
  const [searching, setSearching] = useState(false)
  const [picked, setPicked] = useState<Found | null>(null)
  const [role, setRole] = useState<Role>('staff')
  const [scope, setScope] = useState<TeamScope>(defaultScope)
  // change / remove
  const [editing, setEditing] = useState<Member | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [busy, setBusy] = useState(false)
  const seq = useRef(0)

  useEffect(() => {
    if (!adding || picked || query.trim().length < 2) { setResults([]); return }
    const mine = ++seq.current
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/team/search?q=${encodeURIComponent(query.trim())}`)
        const data = await res.json().catch(() => ({}))
        if (mine === seq.current) setResults(res.ok ? data.results ?? [] : [])
      } finally {
        if (mine === seq.current) setSearching(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [query, adding, picked])

  const closeAll = () => { setAdding(false); setEditing(null); setConfirmRemove(false); setQuery(''); setResults([]); setPicked(null); setRole('staff'); setScope(defaultScope) }

  const finish = async (body: object, done: string) => {
    setBusy(true)
    const error = await send(body)
    setBusy(false)
    if (error) { toast.error(error); return }
    toast.success(done)
    closeAll()
    router.refresh()
  }

  const openAdd = (r: Role) => { closeAll(); setRole(r); setAdding(true) }
  const cancelInvite = async (id: string) => {
    await fetch('/api/admin/team/invite/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    router.refresh()
  }
  const resendInvite = async (id: string, email: string) => {
    const res = await fetch('/api/admin/team/invite/resend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { toast.error(d.error ?? 'Could not send that again.'); return }
    toast.success(d.emailed ? `Invite sent again to ${email}` : 'We could not email them. Copy the new link from the invite box instead.')
    router.refresh()
  }
  const copyInviteLink = async (id: string) => {
    const res = await fetch('/api/admin/team/invite/resend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, email: false }) })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { toast.error(d.error ?? 'Could not make a link.'); return }
    if (await copyText(d.link)) toast.success('New link copied. The link in the earlier email no longer works.')
    else window.prompt('Copy this link and send it to them (the earlier link no longer works):', d.link)
    router.refresh()
  }
  const daysLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000))
  const owners = members.filter(m => m.role === 'admin')
  const desk = members.filter(m => m.role === 'staff')

  const Row = ({ m }: { m: Member }) => {
    const inner = (
      <>
        <span aria-hidden className="inline-flex items-center justify-center rounded-full text-[13px] font-extrabold shrink-0"
          style={{ width: 40, height: 40, background: m.isMe ? 'var(--brand-primary)' : 'var(--bg-raised)', color: m.isMe ? 'var(--brand-primary-on)' : 'var(--text-primary)', border: m.isMe ? 'none' : '1px solid var(--border)' }}>
          {getInitials(m.name)}
        </span>
        <span className="min-w-0 text-left">
          <span className="block text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
            {m.name}{m.isMe && <span className="ml-1.5 text-[10.5px] font-semibold" style={{ color: 'var(--text-subtle)' }}>you</span>}
          </span>
          <span className="block text-[11.5px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{m.scopeLabel}</span>
        </span>
        <span className="ml-auto shrink-0 text-[10.5px] font-extrabold uppercase px-2.5 py-1 rounded-full whitespace-nowrap"
          style={{ letterSpacing: '0.04em', ...(m.role === 'admin'
            ? { background: 'var(--brand-primary-muted)', color: 'var(--brand-primary-text)', border: '1px solid var(--brand-primary)' }
            : { background: 'var(--bg-raised)', color: 'var(--text-muted)', border: '1px solid var(--border)' }) }}>{ROLE_TEXT[m.role].pill}</span>
        {!m.isMe && <span aria-hidden className="text-lg" style={{ color: 'var(--text-subtle)' }}>›</span>}
      </>
    )
    const cls = 'flex items-center gap-3 px-3.5 py-3 w-full'
    const style = { minHeight: 68, borderBottom: '1px solid var(--border)' } as const
    return m.isMe
      ? <div className={cls} style={style}>{inner}</div>
      : <button type="button" className={cls} style={style} onClick={() => { setEditing(m); setRole(m.role); setScope(m.scope); setConfirmRemove(false) }}>{inner}</button>
  }

  const tile = 'rounded-[20px] p-5 flex items-center justify-between gap-4'
  const addBtn = 'shrink-0 rounded-full px-4 py-2.5 text-[13px] font-extrabold whitespace-nowrap'
  return (
    <div className="w-full">
      {/* on a computer: the two roles first, as tiles with a count and their own add button */}
      <div className="hidden lg:grid grid-cols-2 gap-4 mb-4">
        <div className={`${tile} text-white`} style={{ background: 'linear-gradient(160deg, #2c5fc4, #1d3f8d)' }} data-testid="role-owners">
          <div className="min-w-0">
            <div className="text-[11px] font-extrabold" style={{ letterSpacing: '0.14em', opacity: 0.8 }}>OWNERS</div>
            <div className="flex items-baseline gap-2 mt-1"><span className="text-[44px] font-extrabold leading-none">{owners.length}</span><span className="text-base font-bold" style={{ color: '#ffffff', opacity: 0.9 }}>{owners.length === 1 ? 'person' : 'people'}</span></div>
            <div className="text-[13px] mt-1.5" style={{ opacity: 0.85 }}>Everything, including money and settings</div>
          </div>
          <button type="button" className={addBtn} style={{ background: '#ffffff', color: '#1d3f8d' }} onClick={() => openAdd('admin')}>+ Add owner</button>
        </div>
        <div className={tile} style={{ background: 'linear-gradient(160deg, var(--bg-raised), var(--bg-surface))', border: '1px solid var(--border)' }} data-testid="role-desk">
          <div className="min-w-0">
            <div className="text-[11px] font-extrabold" style={{ letterSpacing: '0.14em', color: 'var(--text-muted)' }}>FRONT DESK</div>
            <div className="flex items-baseline gap-2 mt-1"><span className="text-[44px] font-extrabold leading-none" style={{ color: 'var(--text-primary)' }}>{desk.length}</span><span className="text-base font-bold" style={{ color: 'var(--text-muted)' }}>{desk.length === 1 ? 'person' : 'people'}</span></div>
            <div className="text-[13px] mt-1.5" style={{ color: 'var(--text-muted)' }}>Runs the day. No money, no settings</div>
          </div>
          <button type="button" className={addBtn} style={{ background: 'var(--today-block-bg)', color: 'var(--today-block-fg)', boxShadow: 'var(--today-block-shadow)' }} onClick={() => openAdd('staff')}>+ Add front desk</button>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-4 lg:items-start">
      <div className="lg:col-start-2 lg:row-start-1">{aside}</div>
      <div className="lg:col-start-1 lg:row-start-1 min-w-0">

      {/* computer: everyone in one card */}
      <div className="hidden lg:block rounded-[20px] overflow-hidden" style={card} data-testid="team-everyone">
        <div className="text-[11px] font-extrabold uppercase px-5 pt-5 pb-1" style={sectionLabel}>Everyone on your team</div>
        {[...owners, ...desk].map(m => <Row key={m.id} m={m} />)}
        {desk.length === 0 && <div className="px-5 py-4 text-sm" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>No front desk yet. They run the day without seeing any money.</div>}
        {invites.map(i => (
          <div key={i.id} className="flex items-center gap-3 px-3.5 py-3" style={{ minHeight: 68, borderBottom: '1px solid var(--border)' }} data-testid="team-invite-row">
            <span aria-hidden className="inline-flex items-center justify-center rounded-full text-[13px] font-extrabold shrink-0" style={{ width: 40, height: 40, border: '1.5px solid var(--border)', color: 'var(--text-subtle)' }}>{getInitials(i.email)}</span>
            <span className="min-w-0 text-left">
              <span className="block text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{i.email}</span>
              <span className="block text-[11.5px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{ROLE_TEXT[i.role].title} · {i.scopeLabel} · {daysLeft(i.expiresAt) === 0 ? 'expires today' : `expires in ${daysLeft(i.expiresAt)} ${daysLeft(i.expiresAt) === 1 ? 'day' : 'days'}`}</span>
            </span>
            <span className="ml-auto shrink-0 text-[10.5px] font-extrabold uppercase px-2.5 py-1 rounded-full whitespace-nowrap" style={{ letterSpacing: '0.04em', background: 'var(--brand-yellow-muted)', color: 'var(--text-primary)' }}>Invite sent</span>
            <button type="button" onClick={() => copyInviteLink(i.id)} className="shrink-0 text-xs font-bold px-1" style={{ color: 'var(--brand-primary-text)' }} data-testid="copy-invite-link">Copy link</button>
            <button type="button" onClick={() => resendInvite(i.id, i.email)} className="shrink-0 text-xs font-bold px-1" style={{ color: 'var(--brand-primary-text)' }} data-testid="resend-invite">Resend</button>
            <button type="button" onClick={() => cancelInvite(i.id)} className="shrink-0 text-xs font-semibold px-1" style={{ color: 'var(--text-muted)' }} data-testid="cancel-invite-row">Cancel</button>
          </div>
        ))}
        <p className="text-xs px-5 py-3.5 leading-relaxed" style={{ color: 'var(--text-subtle)' }}>Already have a PadelMate account? Use Add owner or Add front desk and search by name. No account yet? Send an invite by email.</p>
      </div>

      <div className="lg:hidden">
      <button type="button" onClick={() => { closeAll(); setAdding(true) }}
        className="btn-main mt-4">
        + Add team member
      </button>

      <div className="text-[11px] font-extrabold uppercase mt-6 mb-2 px-0.5" style={sectionLabel}>Owners</div>
      <div className="rounded-[20px] overflow-hidden" style={card}>{owners.length > 0 ? owners.map(m => <Row key={m.id} m={m} />) : <div className="px-3.5 py-4 text-sm" style={{ color: 'var(--text-muted)' }}>No owners in your reach.</div>}</div>

      <div className="text-[11px] font-extrabold uppercase mt-6 mb-2 px-0.5" style={sectionLabel}>Front desk</div>
      <div className="rounded-[20px] overflow-hidden" style={card}>{desk.length > 0 ? desk.map(m => <Row key={m.id} m={m} />) : <div className="px-3.5 py-4 text-sm" style={{ color: 'var(--text-muted)' }}>No front-desk staff yet. Add someone above.</div>}</div>

      <p className="text-xs mt-3 px-1 leading-relaxed" style={{ color: 'var(--text-subtle)' }}>
        Owners see everything, including money and settings. Front desk runs the day but sees no money. Already have a PadelMate account? Use Add team member. No account yet? Send an invite.
      </p>
      </div>
      </div>
      </div>

      {adding && (
        <Sheet title="Add team member" onClose={closeAll}>
          <p className="text-[12.5px] mt-1" style={{ color: 'var(--text-muted)' }}>Find them by name or email. They need a PadelMate account.</p>
          {!picked ? (
            <>
              <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Name or email" aria-label="Find a person"
                className="w-full rounded-xl px-3.5 mt-4 text-sm" style={{ minHeight: 46, background: 'var(--bg-raised)', border: '1px solid var(--brand-primary)', color: 'var(--text-primary)' }} />
              <div className="mt-2.5 rounded-[14px] overflow-hidden" style={{ border: results.length > 0 ? '1px solid var(--border)' : 'none' }}>
                {results.map(r => {
                  const onTeam = r.role === 'admin' || r.role === 'staff'
                  return (
                    <button key={r.id} type="button" disabled={onTeam} onClick={() => setPicked(r)}
                      className="flex items-center gap-3 px-3 py-2 w-full text-left disabled:opacity-60" style={{ minHeight: 60, borderBottom: '1px solid var(--border)' }}>
                      <span aria-hidden className="inline-flex items-center justify-center rounded-full text-xs font-extrabold shrink-0" style={{ width: 36, height: 36, background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>{getInitials(r.name)}</span>
                      <span className="min-w-0"><span className="block text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{r.name}</span><span className="block text-[11.5px] truncate" style={{ color: 'var(--text-muted)' }}>{r.email}</span></span>
                      {onTeam && <span className="ml-auto text-[10.5px] font-extrabold uppercase px-2 py-1 rounded-full" style={{ background: 'var(--bg-raised)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>{r.isMe ? 'You' : 'On team'}</span>}
                    </button>
                  )
                })}
              </div>
              {query.trim().length >= 2 && !searching && results.length === 0 && (
                <p className="text-xs mt-3 px-1" style={{ color: 'var(--text-muted)' }}>No one found. They need to sign up to PadelMate first, and their home club needs to be one you cover.</p>
              )}
            </>
          ) : (
            <div className="flex items-center gap-3 mt-4 rounded-[14px] px-3 py-2" style={{ background: 'var(--brand-primary-muted)', border: '1px solid var(--brand-primary)', minHeight: 60 }}>
              <span aria-hidden className="inline-flex items-center justify-center rounded-full text-xs font-extrabold shrink-0" style={{ width: 36, height: 36, background: 'var(--brand-primary)', color: 'var(--brand-primary-on)' }}>{getInitials(picked.name)}</span>
              <span className="min-w-0"><span className="block text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{picked.name}</span><span className="block text-[11.5px] truncate" style={{ color: 'var(--text-muted)' }}>{picked.email}</span></span>
              <button type="button" onClick={() => setPicked(null)} className="ml-auto text-xs font-bold px-2" style={{ minHeight: 40, color: 'var(--link-change)' }}>Change</button>
            </div>
          )}
          {picked && (
            <>
              <Label>Their role</Label><RolePicker role={role} setRole={setRole} />
              <Label>Which clubs</Label><ScopePicker scope={scope} setScope={setScope} clubs={clubs} countries={countries} canGrantAll={canGrantAll} />
              <button type="button" disabled={busy} onClick={() => finish({ action: 'add', userId: picked.id, role, scope }, `${picked.name} added as ${ROLE_TEXT[role].title}`)}
                className="flex items-center justify-center w-full rounded-2xl mt-4 text-[14.5px] font-extrabold disabled:opacity-60" style={{ minHeight: 48, background: 'var(--brand-primary)', color: 'var(--brand-primary-on)' }}>
                {busy ? 'Adding…' : `Add ${picked.name.split(' ')[0]} as ${ROLE_TEXT[role].title}`}
              </button>
            </>
          )}
        </Sheet>
      )}

      {editing && (
        <Sheet title={<span>{editing.name}<span className="block text-xs font-normal mt-0.5" style={{ color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>{editing.email}</span></span>} onClose={closeAll}>
          <Label>Role</Label><RolePicker role={role} setRole={setRole} />
          <Label>Which clubs</Label><ScopePicker scope={scope} setScope={setScope} clubs={clubs} countries={countries} canGrantAll={canGrantAll} />
          <button type="button" disabled={busy} onClick={() => finish({ action: 'update', userId: editing.id, role, scope }, 'Saved')}
            className="btn-main mt-4">
            {busy ? 'Saving…' : 'Save changes'}
          </button>
          {!confirmRemove ? (
            <button type="button" onClick={() => setConfirmRemove(true)} className="flex items-center justify-center w-full rounded-2xl mt-2.5 text-sm font-extrabold"
              style={{ minHeight: 48, background: 'var(--brand-crimson-muted)', border: '1px solid var(--brand-crimson)', color: 'var(--brand-crimson)' }}>Remove from team</button>
          ) : (
            <div className="rounded-2xl mt-2.5 p-3.5" style={{ background: 'var(--brand-crimson-muted)', border: '1px solid var(--brand-crimson)' }}>
              <p className="text-[13px]" style={{ color: 'var(--text-primary)' }}>Remove {editing.name.split(' ')[0]} from the team? They become a regular player. Their bookings and history stay.</p>
              <div className="flex gap-2 mt-3">
                <button type="button" onClick={() => setConfirmRemove(false)} className="flex-1 rounded-xl text-sm font-bold" style={{ minHeight: 46, background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>Keep</button>
                <button type="button" disabled={busy} onClick={() => finish({ action: 'remove', userId: editing.id }, `${editing.name.split(' ')[0]} removed from the team`)}
                  className="flex-1 rounded-xl text-sm font-extrabold disabled:opacity-60" style={{ minHeight: 46, background: 'var(--brand-crimson)', color: 'var(--brand-primary-on)' }}>{busy ? 'Removing…' : 'Remove'}</button>
              </div>
            </div>
          )}
        </Sheet>
      )}
    </div>
  )
}
