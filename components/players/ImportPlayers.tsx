'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { INTRO_MAX, emailCopy, cleanIntro, FOOTER_TEXT } from '@/lib/contact-rules'
import { MAX_FILE_BYTES, MAX_ROWS, classify, guessMapping, isEmail, mapRows, normEmail, parseCsv, type Cell, type Mapping, type MappedRow, type RawRow } from '@/lib/contact-import'

type Step = 'file' | 'check' | 'invite' | 'done'
type Result = { added: number; linked: number; alreadyImported: number; duplicates: number; invalid: number }
const card = { background: 'var(--bg-surface)', border: '1px solid var(--border)' } as const
const field = { background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-primary)' } as const
const label = { letterSpacing: '0.12em', color: 'var(--text-subtle)' } as const

async function readFile(file: File): Promise<{ headers: string[]; rows: RawRow[] }> {
  if (file.size > MAX_FILE_BYTES) throw new Error('That file is over 5 MB. Try a smaller one.')
  const name = file.name.toLowerCase()
  let table: Cell[][]
  if (name.endsWith('.xlsx')) { const mod = await import('read-excel-file'); table = (await mod.default(file)) as Cell[][] }
  else if (name.endsWith('.csv') || name.endsWith('.txt')) table = parseCsv(await file.text())
  else throw new Error('Please choose an Excel (.xlsx) or CSV file.')
  const clean = table.filter(r => r.some(c => String(c ?? '').trim() !== ''))
  if (clean.length < 2) throw new Error('That file has no players in it. The first row should be the headings.')
  const headers = clean[0].map(c => String(c ?? '').trim())
  const rows = clean.slice(1)
  if (rows.length > MAX_ROWS) throw new Error(`That file has ${rows.length.toLocaleString()} rows. Up to ${MAX_ROWS.toLocaleString()} at a time, please split it.`)
  return { headers, rows }
}

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?'

export default function ImportPlayers({ venueSlug, club, pending, startAtInvite, emailReady }: { venueSlug: string; club: string; pending: number; startAtInvite: boolean; emailReady: boolean }) {
  const router = useRouter()
  // How many were already saved when this page opened. Fixed on purpose: the page refreshes after saving, and the new
  // people must not be counted twice.
  const [pendingAtStart] = useState(pending)
  const [step, setStep] = useState<Step>(startAtInvite && pending > 0 ? 'invite' : 'file')
  const [fileName, setFileName] = useState('')
  const [raw, setRaw] = useState<{ headers: string[]; rows: RawRow[] } | null>(null)
  const [mapping, setMapping] = useState<Mapping>({ name: null, nameLast: null, email: null, phone: null, lastPlayed: null })
  const [fixes, setFixes] = useState<Record<number, string>>({})
  const [onPm, setOnPm] = useState<Set<string>>(new Set())
  const [imported, setImported] = useState<Set<string>>(new Set())
  const [checking, setChecking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [intro, setIntro] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [progress, setProgress] = useState<{ sent: number; total: number } | null>(null)
  const [sentTotal, setSentTotal] = useState(0)
  const [drag, setDrag] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const mapped = useMemo(() => (raw ? mapRows(raw.rows, mapping) : { rows: [] as MappedRow[], blank: 0 }), [raw, mapping])
  const effective = useMemo<MappedRow[]>(() => mapped.rows.map(r => (fixes[r.line] != null ? { ...r, email: normEmail(fixes[r.line]) } : r)), [mapped, fixes])
  const validEmails = useMemo(() => Array.from(new Set(effective.map(r => r.email).filter(isEmail))), [effective])
  const cls = useMemo(() => classify(effective, { profiles: new Map(Array.from(onPm).map(e => [e, 'x'])), contacts: imported }), [effective, onPm, imported])

  // Ask the server which of these emails are already on PadelMate or already imported, after the owner stops changing things.
  useEffect(() => {
    if (step !== 'check' || validEmails.length === 0) return
    let live = true; setChecking(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch('/api/admin/contacts/check', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ venueSlug, emails: validEmails }) })
        const j = await res.json().catch(() => ({}))
        if (!live) return
        if (!res.ok) { setError(j.error ?? 'Could not check the list.'); setChecking(false); return }
        setOnPm(new Set(j.onPadelmate ?? [])); setImported(new Set(j.imported ?? [])); setError(null); setChecking(false)
      } catch { if (live) { setError('Could not check the list. Please try again.'); setChecking(false) } }
    }, 350)
    return () => { live = false; clearTimeout(t) }
  }, [step, validEmails, venueSlug])

  async function take(file: File | undefined) {
    if (!file) return
    setError(null)
    try {
      const r = await readFile(file)
      setFileName(file.name); setRaw(r); setMapping(guessMapping(r.headers)); setFixes({}); setOnPm(new Set()); setImported(new Set()); setStep('check')
    } catch (e: any) { setError(e?.message ?? 'Could not read that file.') }
  }

  async function save() {
    setBusy(true); setError(null)
    try {
      const rows = [...cls.ready, ...cls.onPadelmate].map(r => ({ name: r.name, email: r.email, phone: r.phone, lastPlayed: r.lastPlayed }))
      if (rows.length === 0 && pendingAtStart === 0) { setError('There is nobody new to import from that file.'); setBusy(false); return }
      let j: any = { added: 0, linked: 0, alreadyImported: 0, duplicates: 0, invalid: 0 }
      if (rows.length > 0) {
        const res = await fetch('/api/admin/contacts/import', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ venueSlug, rows }) })
        j = await res.json().catch(() => ({}))
        if (!res.ok) { setError(j.error ?? 'Could not save the players.'); setBusy(false); return }
      }
      setResult(j as Result); setStep(j.added > 0 || pendingAtStart > 0 ? 'invite' : 'done')
    } catch { setError('Could not save the players. Please try again.') }
    setBusy(false)
  }

  const inviteCount = (result?.added ?? 0) + pendingAtStart
  async function sendAll() {
    setBusy(true); setError(null); setProgress({ sent: 0, total: inviteCount })
    let done = 0
    try {
      for (let guard = 0; guard < 200; guard++) {
        const res = await fetch('/api/admin/contacts/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ venueSlug, mode: 'invite', intro, confirmed: true }) })
        const j = await res.json().catch(() => ({}))
        if (!res.ok) { setError(j.error ?? 'Could not send the invites.'); break }
        done += j.sent ?? 0; setProgress({ sent: done, total: inviteCount })
        if ((j.remaining ?? 0) === 0) { setSentTotal(done); setStep('done'); router.refresh(); break }
        if ((j.sent ?? 0) + (j.joined ?? 0) === 0) { setError(`Sent ${done}. Some could not be sent. Try again from Players.`); break }
      }
    } catch { setError('Could not send the invites. Please try again.') }
    setBusy(false)
  }

  const bar = (on: number) => (
    <div className="flex gap-2 my-4" aria-hidden>{[0, 1, 2].map(i => <i key={i} className="flex-1 h-1.5 rounded-full" style={{ background: i <= on ? 'var(--brand-primary)' : 'var(--bg-raised)' }} />)}</div>
  )
  const copy = emailCopy('invite', club, intro)
  const sel = (key: keyof Mapping, title: string, optional: boolean) => (
    <div key={key} className="grid grid-cols-1 sm:grid-cols-[1fr_24px_1fr] gap-2 sm:items-center mb-2.5">
      <select value={mapping[key] ?? ''} onChange={e => setMapping(m => ({ ...m, [key]: e.target.value === '' ? null : Number(e.target.value) }))} data-testid={`map-${key}`} aria-label={title}
        className="rounded-[13px] px-3.5 py-3 text-[14px] font-bold" style={{ ...field, borderColor: mapping[key] != null ? 'rgba(95,224,163,0.5)' : 'var(--border)' }}>
        <option value="">Not in my file</option>
        {raw?.headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
      </select>
      <span className="hidden sm:block text-center" style={{ color: 'var(--text-subtle)' }}>→</span>
      <div className="rounded-[13px] px-3.5 py-3 text-[14px] font-bold" style={{ ...field, color: 'var(--text-muted)' }}>{title}{optional ? ' (optional)' : ''}</div>
    </div>
  )
  const status = (r: MappedRow): { text: string; color: string } => {
    if (!isEmail(r.email)) return { text: 'Fix email', color: '#F5B84B' }
    if (cls.duplicateRows.some(d => d.line === r.line)) return { text: 'Duplicate', color: '#F5B84B' }
    if (cls.onPadelmate.some(d => d.line === r.line)) return { text: 'On PadelMate', color: 'var(--brand-primary-text)' }
    if (cls.alreadyImported.some(d => d.line === r.line)) return { text: 'Already imported', color: 'var(--text-muted)' }
    return { text: 'Ready', color: '#5FE0A3' }
  }
  const lastLabel = (d: string | null) => d ? new Intl.DateTimeFormat('en-NZ', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`)) : '–'

  return (
    <div className="w-full mx-auto" style={{ maxWidth: 820 }} data-testid="import-players">
      <div className="mb-1">
        <Link href={`/players?venue=${venueSlug}`} className="text-[13px] font-bold" style={{ color: 'var(--brand-primary-text)' }}>← Players</Link>
      </div>

      {step === 'file' && (
        <div className="rounded-[22px] p-5 sm:p-6" style={card} data-testid="import-step-file">
          <h2 className="text-xl font-extrabold" style={{ color: 'var(--text-primary)' }}>Import your players</h2>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{club}</p>
          {bar(0)}<div className="text-[12px] font-bold -mt-2 mb-4" style={{ color: 'var(--text-subtle)' }}>1 of 3 · Your list</div>
          <div onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); void take(e.dataTransfer.files?.[0]) }}
            className="rounded-[20px] text-center px-5 py-9" style={{ border: '2px dashed rgba(134,187,247,0.5)', background: drag ? 'rgba(47,112,204,0.18)' : 'rgba(47,112,204,0.08)' }}>
            <div className="text-[17px] font-extrabold" style={{ color: 'var(--text-primary)' }}>Drop your spreadsheet here</div>
            <div className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>Excel or CSV, up to {MAX_ROWS.toLocaleString()} people</div>
            <button type="button" onClick={() => inputRef.current?.click()} className="btn btn-primary btn-sm mt-4" data-testid="import-choose">Choose a file</button>
            <input ref={inputRef} type="file" accept=".xlsx,.csv,.txt" className="hidden" data-testid="import-file" onChange={e => { void take(e.target.files?.[0]); e.target.value = '' }} />
          </div>
          {error && <p role="alert" data-testid="import-error" className="text-[13px] mt-3" style={{ color: 'var(--brand-crimson)' }}>{error}</p>}
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <a href={`data:text/csv;charset=utf-8,${encodeURIComponent('Name,Email,Mobile,Last played\nAroha Ngata,aroha@example.com,021 555 0142,12/11/2025\n')}`} download="players-template.csv" className="btn btn-secondary btn-sm" data-testid="import-template">Download a blank template</a>
            <span className="text-[12.5px]" style={{ color: 'var(--text-muted)' }}>Any list with a name and an email works. If your booking system can export your customers, use that.</span>
          </div>
          <div className="rounded-2xl px-4 py-3 mt-4" style={{ background: 'var(--bg-base)', border: '1px solid var(--border)' }}>
            <div className="text-[13.5px] font-extrabold" style={{ color: 'var(--text-primary)' }}>Only import people who gave you their details</div>
            <div className="text-[12.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Customers, members and people who have played at your club. Not a bought or scraped list.</div>
          </div>
          {pendingAtStart > 0 && <p className="text-[13px] mt-4" style={{ color: 'var(--text-muted)' }}>You also have <b style={{ color: 'var(--text-primary)' }}>{pendingAtStart}</b> imported but not invited yet. <button type="button" className="font-bold underline" style={{ color: 'var(--brand-primary-text)' }} onClick={() => setStep('invite')} data-testid="import-skip-to-invite">Review and send those</button></p>}
        </div>
      )}

      {step === 'check' && raw && (
        <div className="rounded-[22px] p-5 sm:p-6" style={card} data-testid="import-step-check">
          <h2 className="text-xl font-extrabold" style={{ color: 'var(--text-primary)' }}>Check your list</h2>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{fileName} · {mapped.rows.length.toLocaleString()} rows</p>
          {bar(1)}<div className="text-[12px] font-bold -mt-2 mb-4" style={{ color: 'var(--text-subtle)' }}>2 of 3 · Match your columns</div>
          {sel('name', 'Name', false)}{mapping.name != null && raw.headers.length > 0 && mapping.nameLast != null && <div className="text-[12px] -mt-1 mb-2" style={{ color: 'var(--text-muted)' }}>First and last name columns are joined for you.</div>}
          {sel('email', 'Email', false)}{sel('phone', 'Phone', true)}{sel('lastPlayed', 'Last played', true)}
          {mapping.email == null && <p role="alert" className="text-[13px] mb-2" style={{ color: 'var(--brand-crimson)' }} data-testid="import-need-email">Pick the column that has email addresses. We can only invite people by email.</p>}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-4">
            {([['sum-ready', cls.ready.length, 'ready to invite', 'go'], ['sum-onpm', cls.onPadelmate.length, 'already on PadelMate. We link them, no invite', ''], ['sum-dupes', cls.duplicates, 'duplicates in your file, counted once', 'warn'], ['sum-invalid', cls.invalid.length, 'emails that don\'t look right', 'warn']] as [string, number, string, string][]).map(([id, n, l, tone]) => (
              <div key={id} className="rounded-2xl p-3.5" style={{ background: 'var(--bg-base)', border: '1px solid var(--border)' }} data-testid={id}>
                <b className="block text-[26px] leading-none" style={{ color: tone === 'go' ? '#d4f53c' : tone === 'warn' && n > 0 ? '#F5B84B' : 'var(--text-primary)' }}>{checking && tone !== 'warn' ? '…' : n}</b>
                <span className="block text-[11.5px] mt-1.5 leading-snug" style={{ color: 'var(--text-muted)' }}>{l}</span>
              </div>
            ))}
          </div>
          {cls.alreadyImported.length > 0 && <p className="text-[12.5px] mb-3" style={{ color: 'var(--text-muted)' }} data-testid="sum-already">{cls.alreadyImported.length} {cls.alreadyImported.length === 1 ? 'person is' : 'people are'} already imported and will be skipped.</p>}

          <div className="rounded-2xl overflow-hidden text-[13px]" style={{ border: '1px solid var(--border)' }}>
            <div className="hidden sm:grid grid-cols-[1.3fr_1.7fr_0.8fr_1fr] gap-3 px-3.5 py-2 text-[11px] font-extrabold uppercase" style={{ ...label, background: 'var(--bg-raised)' }}><span>Name</span><span>Email</span><span>Last played</span><span>Status</span></div>
            {effective.slice(0, 6).map(r => { const st = status(r); return (
              <div key={r.line} data-testid="check-row" className="grid grid-cols-2 sm:grid-cols-[1.3fr_1.7fr_0.8fr_1fr] gap-x-3 gap-y-0.5 px-3.5 py-2.5" style={{ borderTop: '1px solid var(--border)' }}>
                <span className="font-bold truncate" style={{ color: 'var(--text-primary)' }}>{r.name}</span><span className="truncate text-right sm:text-left" style={{ color: 'var(--text-muted)' }}>{r.email || '–'}</span>
                <span style={{ color: 'var(--text-muted)' }}>{lastLabel(r.lastPlayed)}</span><b className="text-right sm:text-left" style={{ color: st.color }}>{st.text}</b>
              </div>) })}
          </div>

          {cls.invalid.length > 0 && (
            <div className="mt-4" data-testid="invalid-list">
              <div className="text-[13px] font-extrabold mb-2" style={{ color: 'var(--text-primary)' }}>Fix these emails, or leave them out</div>
              {cls.invalid.slice(0, 20).map(r => (
                <div key={r.line} data-testid="invalid-row" className="flex items-center gap-2 mb-2">
                  <span className="w-28 sm:w-40 truncate text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>{r.name}</span>
                  <input defaultValue={r.email} onChange={e => setFixes(f => ({ ...f, [r.line]: e.target.value }))} placeholder="name@email.com" aria-label={`Email for ${r.name}`} data-testid="invalid-input" inputMode="email" className="flex-1 min-w-0 rounded-[12px] px-3 py-2 text-[13px]" style={field} />
                </div>
              ))}
              {cls.invalid.length > 20 && <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>and {cls.invalid.length - 20} more. They are left out.</p>}
            </div>
          )}
          {error && <p role="alert" data-testid="import-error" className="text-[13px] mt-3" style={{ color: 'var(--brand-crimson)' }}>{error}</p>}
          <div className="flex items-center justify-between gap-3 mt-5">
            <button type="button" onClick={() => { setStep('file'); setRaw(null); setError(null) }} className="btn btn-secondary btn-sm">Choose a different file</button>
            <button type="button" onClick={save} disabled={busy || checking || mapping.email == null || (cls.ready.length + cls.onPadelmate.length === 0 && pendingAtStart === 0)} data-testid="import-continue" className="btn btn-primary">{busy ? 'Saving…' : 'Continue →'}</button>
          </div>
        </div>
      )}

      {step === 'invite' && (
        <div className="rounded-[22px] p-5 sm:p-6" style={card} data-testid="import-step-invite">
          <h2 className="text-xl font-extrabold" style={{ color: 'var(--text-primary)' }}>Invite your players</h2>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-muted)' }} data-testid="invite-count">{inviteCount} {inviteCount === 1 ? 'person' : 'people'}{result?.linked ? ` · ${result.linked} already on PadelMate were linked` : ''}</p>
          {bar(2)}<div className="text-[12px] font-bold -mt-2 mb-4" style={{ color: 'var(--text-subtle)' }}>3 of 3 · Send the invite</div>
          <div className="text-[10.5px] font-extrabold uppercase mb-2" style={label}>What they&apos;ll get</div>
          <div className="rounded-2xl p-5" style={{ background: '#fff', color: '#1a1f24' }} data-testid="invite-preview">
            <h3 className="text-[18px] font-extrabold mb-1.5" style={{ border: 0, padding: 0, color: '#1a1f24' }} data-testid="invite-heading">{copy.heading}</h3>
            <p className="text-[14px] leading-relaxed" data-testid="invite-intro-text">{copy.intro}</p>
            <span className="inline-block mt-3 rounded-full px-5 py-2.5 text-[14px] font-extrabold" style={{ background: '#2F70CC', color: '#fff' }}>{copy.cta}</span>
            <p className="text-[11.5px] mt-3" style={{ color: '#68717b' }}>{FOOTER_TEXT(club)} <u>Unsubscribe</u></p>
          </div>
          <label className="block text-[10.5px] font-extrabold uppercase mt-4 mb-1.5" style={label} htmlFor="invite-intro">Add a line of your own (optional)</label>
          <textarea id="invite-intro" data-testid="invite-intro" value={intro} maxLength={INTRO_MAX} rows={2} onChange={e => setIntro(e.target.value)} placeholder={`e.g. Come and see our new courts, ${club.split(' ')[0]} is open daily.`} className="w-full rounded-[14px] px-3.5 py-3 text-[14px]" style={field} />
          <p className="text-[12px] mt-1.5" style={{ color: 'var(--text-muted)' }}>The button opens your booking link, so everyone who joins is tagged &quot;joined via link&quot;. Sent from PadelMate on behalf of {club}.</p>
          <label className="flex gap-3 items-start rounded-2xl px-4 py-3.5 mt-4 cursor-pointer" style={{ background: 'rgba(245,184,75,0.1)', border: '1px solid rgba(245,184,75,0.5)' }}>
            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} data-testid="invite-confirm" className="mt-0.5 w-5 h-5 shrink-0" />
            <span className="text-[13px] font-bold leading-snug" style={{ color: 'var(--text-primary)' }}>I confirm these people have given {club} their details, and we&apos;re allowed to contact them about the club.</span>
          </label>
          {!emailReady && <p role="alert" className="text-[13px] mt-3" style={{ color: 'var(--brand-crimson)' }} data-testid="invite-not-ready">Email isn&apos;t set up on PadelMate yet, so invites can&apos;t be sent. Your players are saved.</p>}
          {error && <p role="alert" data-testid="import-error" className="text-[13px] mt-3" style={{ color: 'var(--brand-crimson)' }}>{error}</p>}
          {progress && <p className="text-[13px] mt-3 font-bold" style={{ color: 'var(--text-primary)' }} data-testid="invite-progress">Sent {progress.sent} of {progress.total}…</p>}
          <div className="flex flex-wrap gap-2.5 mt-5">
            <button type="button" onClick={sendAll} disabled={!confirmed || busy || !emailReady || inviteCount === 0} data-testid="invite-send" className="btn btn-primary" style={{ opacity: !confirmed || !emailReady ? 0.55 : 1 }}>{busy ? 'Sending…' : `Send ${inviteCount} ${inviteCount === 1 ? 'invite' : 'invites'} now`}</button>
            <button type="button" disabled={busy} onClick={() => { toast.success('Saved. You can send the invites any time from Players.'); router.push(`/players?venue=${venueSlug}`); router.refresh() }} data-testid="invite-later" className="btn btn-secondary">Save them, send later</button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="rounded-[22px] p-6 text-center" style={card} data-testid="import-done">
          <div className="text-[34px]">✓</div>
          <h2 className="text-xl font-extrabold mt-1" style={{ color: 'var(--text-primary)' }}>{sentTotal > 0 ? `${sentTotal} ${sentTotal === 1 ? 'invite' : 'invites'} sent` : 'All done'}</h2>
          <p className="text-[13.5px] mt-2 mx-auto" style={{ color: 'var(--text-muted)', maxWidth: 440 }}>
            {sentTotal > 0 ? 'They will show in Players as invited. In 7 days you can send one reminder to anyone who has not joined. Nobody gets more than one.' : 'Nothing new to invite.'}
          </p>
          <Link href={`/players?venue=${venueSlug}`} className="btn btn-primary mt-5" data-testid="import-to-players">See your players</Link>
        </div>
      )}
    </div>
  )
}
