'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { VENUES } from '@/lib/venues'
import {
  FORMATS, GROUP_LABEL, estimate, formatInfo, hm, isPairFormat, isRotationFormat, joinReasons, normalizeSettings, recommend,
  type FormatId, type Goal,
} from '@/lib/tournament-formats'

type Player = { id: string; full_name: string | null; nickname: string | null }

const GOALS: { id: Goal; label: string }[] = [
  { id: 'social', label: 'A relaxed, social day' },
  { id: 'lots', label: 'Everyone plays lots' },
  { id: 'winner', label: 'A proper winner' },
  { id: 'weeks', label: 'Something over weeks' },
]

const card = { background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' } as const
const display = { fontFamily: 'var(--font-display), Manrope, sans-serif', fontWeight: 500 } as const

function weekdayOf(date: string): string {
  const d = new Date(`${date}T12:00:00Z`)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-NZ', { weekday: 'long', timeZone: 'UTC' })
}

function Chip({ on, children, ...rest }: { on: boolean; children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" aria-pressed={on} {...rest}
      className="text-xs font-semibold px-3 py-1.5 rounded-full transition-colors"
      style={{ background: on ? 'var(--brand-primary)' : 'var(--bg-raised)', color: on ? 'var(--brand-primary-on)' : 'var(--text-muted)', border: `1px solid ${on ? 'var(--brand-primary)' : 'var(--border)'}` }}>
      {children}
    </button>
  )
}

export default function NewTournamentForm({
  players, venueSlugs, defaultDate, formatsReady,
}: { players: Player[]; venueSlugs: string[]; defaultDate: string; formatsReady: boolean }) {
  const router = useRouter()
  const venues = useMemo(() => VENUES.filter(v => venueSlugs.includes(v.slug)), [venueSlugs])

  const [venueSlug, setVenueSlug] = useState(venues.length === 1 ? venues[0].slug : '')
  const [date, setDate] = useState(defaultDate)
  const [courts, setCourts] = useState<string[]>([])
  // planning the day
  const [expected, setExpected] = useState(16)
  const [minutes, setMinutes] = useState(180)
  const [mixed, setMixed] = useState(true)
  const [goal, setGoal] = useState<Goal>('social')
  // the choice
  const [format, setFormat] = useState<FormatId>('americano')
  const [name, setName] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
  const [pointsToWin, setPointsToWin] = useState(21)
  const [rounds, setRounds] = useState<number | null>(null)
  const [roundMinutes, setRoundMinutes] = useState(15)
  const [matchMinutes, setMatchMinutes] = useState(30)
  const [thirdPlace, setThirdPlace] = useState(false)
  const [groupSize, setGroupSize] = useState<3 | 4 | 5>(4)
  const [advance, setAdvance] = useState<1 | 2>(2)
  const [apart, setApart] = useState(true)
  // who is playing
  const [picked, setPicked] = useState<string[]>([])
  const [guests, setGuests] = useState<string[]>([])
  const [guestText, setGuestText] = useState('')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  const venue = VENUES.find(v => v.slug === venueSlug)
  const info = formatInfo(format)!
  const rosterCount = picked.length + guests.length
  const planPlayers = rosterCount > 0 ? rosterCount : expected
  const usable = (id: string) => (formatInfo(id)?.ready ?? false) && (formatsReady || id === 'americano' || id === 'mexicano')

  const settings = normalizeSettings(format, { matchMinutes, roundMinutes, thirdPlace, groupSize, advance, groupWinnersApart: apart })
  // until courts are picked, plan for three so the estimate is not misleading
  const plan = { players: planPlayers, courts: courts.length || 3, minutes, matchMinutes, roundMinutes }
  const est = estimate(format, plan, settings)
  const fullRounds = Math.max(1, planPlayers - 1)
  const suggestedRounds = Math.max(1, Math.min(fullRounds, Math.floor(minutes / roundMinutes), 30))
  const totalRounds = rounds ?? suggestedRounds
  const recs = recommend({ ...plan, mixed, goal })
  const endsAt = (() => { const t = 10 * 60 + est.minutes; return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}` })()
  const shownName = nameTouched ? name : `${weekdayOf(date)} ${info.name}`.trim()
  const odd = isPairFormat(format) && rosterCount % 2 === 1

  const list = players.filter(p => !search || `${p.nickname ?? ''} ${p.full_name ?? ''}`.toLowerCase().includes(search.toLowerCase()))
  const toggle = (id: string) => setPicked(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  const toggleCourt = (id: string) => setCourts(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  const addGuest = () => {
    const g = guestText.trim()
    if (!g) return
    if (guests.some(x => x.toLowerCase() === g.toLowerCase())) { toast.error(`${g} is already added`); return }
    setGuests(prev => [...prev, g]); setGuestText('')
  }

  const create = async () => {
    if (!venueSlug) { toast.error('Pick a club'); return }
    if (courts.length === 0) { toast.error('Pick at least one court'); return }
    if (!shownName.trim()) { toast.error('Give the tournament a name'); return }
    if (!usable(format)) { toast.error('That format is not available yet'); return }
    setSaving(true)
    const res = await fetch('/api/tournaments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: shownName.trim(), format, venueSlug, date, courtIds: courts, pointsToWin, totalRounds: isRotationFormat(format) ? totalRounds : 1,
        settings, playerIds: picked, guestNames: guests,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { toast.error(data.error ?? 'Could not create the tournament'); setSaving(false); return }
    toast.success('Tournament created')
    router.push(`/tournaments/${data.id}`)
  }

  const field = (label: string, node: React.ReactNode) => (<div><label className="label">{label}</label>{node}</div>)

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {!formatsReady && (
        <div className="rounded-xl p-3 text-sm" data-testid="formats-not-ready" style={{ background: 'var(--brand-yellow-muted)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
          The new formats need a one-off setup step first. Americano and Mexicano work as usual.
        </div>
      )}

      {/* where and when */}
      <section className="rounded-2xl p-4 space-y-3" style={card}>
        <h2 className="text-sm font-extrabold uppercase tracking-wide" style={{ color: 'var(--text-primary)' }}>Where and when</h2>
        <div className="grid grid-cols-2 gap-3">
          {field('Club', (
            <select className="input text-sm" value={venueSlug} onChange={e => { setVenueSlug(e.target.value); setCourts([]) }} data-testid="venue">
              <option value="">Select</option>
              {venues.map(v => <option key={v.slug} value={v.slug}>{v.name}</option>)}
            </select>
          ))}
          {field('Date', <input type="date" className="input text-sm" value={date} onChange={e => setDate(e.target.value)} />)}
        </div>
        {venue && (
          <div>
            <label className="label">Courts for the day</label>
            <div className="flex flex-wrap gap-1.5">
              {venue.courts.map(c => <Chip key={c.id} on={courts.includes(c.id)} onClick={() => toggleCourt(c.id)} data-testid={`court-${c.id}`}>{c.name}</Chip>)}
            </div>
          </div>
        )}
      </section>

      {/* the helper */}
      <section className="rounded-2xl p-4 space-y-3" style={card} data-testid="helper">
        <div>
          <h2 className="text-sm font-extrabold uppercase tracking-wide" style={{ color: 'var(--text-primary)' }}>Which format should I pick?</h2>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Tell us about the day and we suggest what suits it. You can always choose another.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Players expected: {expected}</label>
            <input type="range" min={4} max={48} step={1} value={expected} onChange={e => setExpected(Number(e.target.value))} className="w-full" aria-label="Players expected" data-testid="expected" />
          </div>
          <div>
            <label className="label">Time available: {hm(minutes)}</label>
            <input type="range" min={60} max={480} step={15} value={minutes} onChange={e => setMinutes(Number(e.target.value))} className="w-full" aria-label="Time available" data-testid="minutes" />
          </div>
        </div>
        <div>
          <label className="label">Levels</label>
          <div className="flex gap-1.5">
            <Chip on={mixed} onClick={() => setMixed(true)}>Mixed levels</Chip>
            <Chip on={!mixed} onClick={() => setMixed(false)}>Similar levels</Chip>
          </div>
        </div>
        <div>
          <label className="label">What do you want most?</label>
          <div className="flex flex-wrap gap-1.5">{GOALS.map(g => <Chip key={g.id} on={goal === g.id} onClick={() => setGoal(g.id)} data-testid={`goal-${g.id}`}>{g.label}</Chip>)}</div>
        </div>
        <div className="space-y-1.5" data-testid="recs">
          {recs.map((r, i) => {
            const text = joinReasons(r.reasons)
            const body = (
              <>
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: 'var(--brand-yellow)', color: 'var(--brand-yellow-on)' }}>{i + 1}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{r.name}</span>
                  {text && <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>{text}</span>}
                </span>
              </>
            )
            const style = { background: 'var(--bg-raised)', border: `1px solid ${format === r.id ? 'var(--brand-primary)' : 'var(--border)'}` }
            return r.href
              ? <a key={r.id} href={r.href} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={style} data-testid={`rec-${r.id}`}>{body}</a>
              : <button key={r.id} type="button" className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left" style={style} onClick={() => setFormat(r.id as FormatId)} data-testid={`rec-${r.id}`}>{body}</button>
          })}
        </div>
      </section>

      {/* the picker */}
      <section className="space-y-3">
        {(['social', 'comp'] as const).map(g => (
          <div key={g}>
            <h2 className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>{GROUP_LABEL[g]}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {FORMATS.filter(f => f.group === g).map(f => {
                const on = format === f.id, can = usable(f.id)
                const e = estimate(f.id, plan, normalizeSettings(f.id, {}))
                return (
                  <button key={f.id} type="button" disabled={!can} aria-pressed={on} onClick={() => setFormat(f.id)} data-testid={`fmt-${f.id}`}
                    className="text-left rounded-xl p-3 transition-colors disabled:opacity-60"
                    style={{ background: on ? 'var(--brand-primary-muted)' : 'var(--bg-surface)', border: `1px solid ${on ? 'var(--brand-primary)' : 'var(--border)'}`, boxShadow: on ? 'var(--glow-primary)' : 'none' }}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold" style={{ color: on ? 'var(--brand-primary-text)' : 'var(--text-primary)' }}>{f.name}</span>
                      {!f.ready && <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0" style={{ background: 'var(--bg-raised)', color: 'var(--text-muted)' }}>Coming soon</span>}
                      {f.ready && !can && <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0" style={{ background: 'var(--brand-yellow-muted)', color: 'var(--text-primary)' }}>Setup needed</span>}
                    </div>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{f.blurb}</p>
                    {f.ready && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: e.fits ? 'var(--brand-green-muted)' : 'var(--brand-crimson-muted)', color: e.fits ? 'var(--brand-green)' : 'var(--brand-crimson)' }}>{e.fits ? 'Fits your day' : `About ${hm(e.minutes)}`}</span>
                        {!e.inRange && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-raised)', color: 'var(--text-muted)' }}>Better with {f.need[0]} to {f.need[1]} {f.unit}</span>}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </section>

      {/* set up */}
      <section className="rounded-2xl p-4 space-y-3" style={card}>
        <div>
          <h2 className="text-lg" style={{ ...display, color: 'var(--text-primary)' }}>{info.name}</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{info.blurb}</p>
        </div>
        {field('Name', <input type="text" className="input text-sm" value={shownName} onChange={e => { setName(e.target.value); setNameTouched(true) }} data-testid="name" />)}
        {isRotationFormat(format) ? (
          <div className="grid grid-cols-3 gap-3">
            {field('Points to win', <input type="number" min={1} className="input text-sm" value={pointsToWin} onChange={e => setPointsToWin(Number(e.target.value))} />)}
            {field('Rounds', <input type="number" min={1} max={30} className="input text-sm" value={totalRounds} onChange={e => setRounds(Number(e.target.value))} data-testid="rounds" />)}
            {field('Round length', (
              <select className="input text-sm" value={roundMinutes} onChange={e => setRoundMinutes(Number(e.target.value))}>
                {[10, 12, 15, 20, 25, 30].map(v => <option key={v} value={v}>{v} min</option>)}
              </select>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {field('Match length', (
              <select className="input text-sm" value={matchMinutes} onChange={e => setMatchMinutes(Number(e.target.value))}>
                {[20, 30, 45, 60].map(v => <option key={v} value={v}>{v} min</option>)}
              </select>
            ))}
            {(format === 'single_elim' || format === 'groups_knockout') && (
              <div>
                <label className="label">Third-place match</label>
                <div className="flex gap-1.5"><Chip on={!thirdPlace} onClick={() => setThirdPlace(false)}>No</Chip><Chip on={thirdPlace} onClick={() => setThirdPlace(true)} data-testid="third-place">Yes</Chip></div>
              </div>
            )}
          </div>
        )}
        {format === 'groups_knockout' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Pairs per group</label>
              <div className="flex gap-1.5">{([3, 4, 5] as const).map(v => <Chip key={v} on={groupSize === v} onClick={() => setGroupSize(v)} data-testid={`group-size-${v}`}>{v}</Chip>)}</div>
            </div>
            <div>
              <label className="label">Through from each group</label>
              <div className="flex gap-1.5">{([2, 1] as const).map(v => <Chip key={v} on={advance === v} onClick={() => setAdvance(v)} data-testid={`advance-${v}`}>{v === 2 ? 'Top 2' : 'Top 1'}</Chip>)}</div>
            </div>
            <div className="col-span-2">
              <label className="label">Knockout draw</label>
              <div className="flex gap-1.5"><Chip on={apart} onClick={() => setApart(true)}>Keep group-mates apart</Chip><Chip on={!apart} onClick={() => setApart(false)}>Seed by results only</Chip></div>
            </div>
          </div>
        )}

        <div className="rounded-xl p-3 text-sm" style={{ background: 'var(--bg-raised)', color: 'var(--text-primary)' }} data-testid="estimate">
          <div className="font-semibold">{planPlayers} players · {plan.courts} court{plan.courts === 1 ? '' : 's'}{courts.length === 0 && <span className="font-normal" style={{ color: 'var(--text-muted)' }}> (assumed until you pick your courts)</span>}</div>
          <div style={{ color: 'var(--text-muted)' }} className="mt-0.5">{est.summary} · ends about <b style={{ color: 'var(--text-primary)' }}>{endsAt}</b> if you start at 10:00</div>
          {est.each && <div style={{ color: 'var(--text-muted)' }}>{est.each}</div>}
          {est.note && <div className="mt-1" style={{ color: 'var(--brand-crimson)' }}>{est.note}</div>}
          <div className="mt-1" style={{ color: est.fits ? 'var(--brand-green)' : 'var(--brand-crimson)' }}>{est.fits ? `Fits your ${hm(minutes)}.` : `Needs about ${hm(est.minutes)}, more than your ${hm(minutes)}.`}</div>
        </div>
      </section>

      {/* roster */}
      <section className="rounded-2xl p-4 space-y-3" style={card}>
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-extrabold uppercase tracking-wide" style={{ color: 'var(--text-primary)' }}>Players ({rosterCount})</h2>
          {isPairFormat(format) && <span className="text-xs" style={{ color: odd ? 'var(--brand-crimson)' : 'var(--text-muted)' }}>{odd ? 'Odd number: one has no partner' : `${Math.floor(rosterCount / 2)} pairs`}</span>}
        </div>
        <div>
          <label className="label">Add a guest without an account</label>
          <div className="flex gap-2">
            <input type="text" className="input text-sm flex-1" placeholder="Guest name" value={guestText} maxLength={40} onChange={e => setGuestText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addGuest() } }} data-testid="guest-input" />
            <button type="button" className="btn btn-sm" onClick={addGuest} data-testid="add-guest">Add</button>
          </div>
          {guests.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {guests.map(g => (
                <span key={g} className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-raised)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                  {g}<button type="button" aria-label={`Remove ${g}`} onClick={() => setGuests(prev => prev.filter(x => x !== g))} style={{ color: 'var(--brand-crimson)' }}>×</button>
                </span>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className="label">Club members</label>
          <input type="search" className="input text-sm mb-2" placeholder="Search players" value={search} onChange={e => setSearch(e.target.value)} />
          <div className="max-h-60 overflow-y-auto space-y-1.5">
            {list.map(p => (
              <button key={p.id} type="button" onClick={() => toggle(p.id)} aria-pressed={picked.includes(p.id)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left"
                style={{ background: picked.includes(p.id) ? 'var(--brand-primary-muted)' : 'var(--bg-raised)', border: `1px solid ${picked.includes(p.id) ? 'var(--brand-primary)' : 'var(--border)'}` }}>
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{p.nickname ?? p.full_name}</span>
                {picked.includes(p.id) && <span style={{ color: 'var(--brand-primary-text)' }}>✓</span>}
              </button>
            ))}
            {list.length === 0 && <p className="text-xs py-2" style={{ color: 'var(--text-muted)' }}>No one matches that search.</p>}
          </div>
        </div>
      </section>

      <button className="btn btn-primary w-full justify-center py-3" disabled={saving || !usable(format)} onClick={create} data-testid="create-tournament">
        {saving ? 'Creating…' : 'Create tournament'}
      </button>
      {isPairFormat(format) && <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>Next you will make the pairs: a random draw, balanced by level, or picked by hand.</p>}
    </div>
  )
}
