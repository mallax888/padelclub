'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { VENUES } from '@/lib/venues'
import { formatDate } from '@/lib/utils'
import {
  FORMATS, GROUP_LABEL, estimate, formatInfo, hm, isPairFormat, isRotationFormat, joinReasons, normalizeSettings, recommend,
  type FormatId, type Goal,
} from '@/lib/tournament-formats'
import { AnsweredRow, AskCard, FlowButton, FlowProgress, LaterRow, FLOW_FRAME } from '@/components/ui/PromptFlow'

type Player = { id: string; full_name: string | null; nickname: string | null }
type Step = 'where' | 'size' | 'format' | 'fine' | 'players'

const STEPS: Step[] = ['where', 'size', 'format', 'fine', 'players']
const LABEL: Record<Step, string> = {
  where: 'Where and when?',
  size: 'How big is the day?',
  format: 'Which format?',
  fine: 'Fine-tune the details',
  players: 'Who is playing?',
}

const GOALS: { id: Goal; label: string }[] = [
  { id: 'social', label: 'A relaxed, social day' },
  { id: 'lots', label: 'Everyone plays lots' },
  { id: 'winner', label: 'A proper winner' },
  { id: 'weeks', label: 'Something over weeks' },
]

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

// One format as a tappable card: its name, what it is, whether it fits the day.
// Declared outside the form so it keeps its identity between renders.
function FormatCard({ name, blurb, note, tag, on, disabled, badge, onClick, testId }: {
  name: string; blurb: string; note?: string; tag?: { text: string; ok: boolean } | null; on: boolean; disabled?: boolean
  badge?: string; onClick: () => void; testId: string
}) {
  return (
    <button type="button" disabled={disabled} aria-pressed={on} onClick={onClick} data-testid={testId}
      className="text-left rounded-xl p-3.5 transition-colors disabled:opacity-60 w-full"
      style={{ background: on ? 'var(--brand-primary-muted)' : 'var(--bg-raised)', border: `1px solid ${on ? 'var(--brand-primary)' : 'var(--border)'}`, boxShadow: on ? 'var(--glow-primary)' : 'none' }}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold" style={{ color: on ? 'var(--brand-primary-text)' : 'var(--text-primary)' }}>{name}</span>
        <span className="flex gap-1.5 shrink-0">
          {badge && <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ background: 'var(--brand-yellow-muted)', color: 'var(--text-primary)' }}>{badge}</span>}
          {tag && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: tag.ok ? 'var(--brand-green-muted)' : 'var(--brand-crimson-muted)', color: tag.ok ? 'var(--brand-green)' : 'var(--brand-crimson)' }}>{tag.text}</span>}
        </span>
      </div>
      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{blurb}</p>
      {note && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{note}</p>}
    </button>
  )
}

export default function NewTournamentForm({
  players, venueSlugs, defaultDate, formatsReady,
}: { players: Player[]; venueSlugs: string[]; defaultDate: string; formatsReady: boolean }) {
  const router = useRouter()
  const venues = useMemo(() => VENUES.filter(v => venueSlugs.includes(v.slug)), [venueSlugs])

  const [step, setStep] = useState<Step>('where')
  const [showAll, setShowAll] = useState(false)
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
    if (!venueSlug) { toast.error('Pick a club'); setStep('where'); return }
    if (courts.length === 0) { toast.error('Pick at least one court'); setStep('where'); return }
    if (!shownName.trim()) { toast.error('Give the tournament a name'); setStep('fine'); return }
    if (!usable(format)) { toast.error('That format is not available yet'); setStep('format'); return }
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
  const fitTag = (id: FormatId) => {
    const f = formatInfo(id)
    if (!f?.ready) return null
    const e = estimate(id, plan, normalizeSettings(id, {}))
    return { text: e.fits ? `Fits your ${hm(minutes)}` : `About ${hm(e.minutes)}`, ok: e.fits }
  }
  const stepIndex = STEPS.indexOf(step)
  const go = (s: Step) => { setStep(s); if (s === 'format') setShowAll(false) }
  const nextStep = () => go(STEPS[stepIndex + 1])
  const whereReady = !!venueSlug && courts.length > 0
  const courtNames = venue ? venue.courts.filter(c => courts.includes(c.id)).map(c => c.name).join(', ') : ''
  const goalLabel = GOALS.find(g => g.id === goal)?.label ?? ''
  const open = (s: Step) => ({ n: STEPS.indexOf(s) + 1, total: STEPS.length, title: LABEL[s] })

  // Recommended formats first; the one picked is always shown, so Continue never names a format
  // that is not on screen.
  const recFormats = recs.filter(r => !r.href)
  const ladderRec = recs.find(r => r.href)
  const shownIds: FormatId[] = recFormats.map(r => r.id as FormatId)
  if (!shownIds.includes(format)) shownIds.unshift(format)

  return (
    <div className={FLOW_FRAME}>
      <FlowProgress total={STEPS.length} current={stepIndex + 1} />
      <div className="flex flex-col gap-4">
        {!formatsReady && (
          <div className="rounded-xl p-3 text-sm" data-testid="formats-not-ready" style={{ background: 'var(--brand-yellow-muted)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
            The new formats need a one-off setup step first. Americano and Mexicano work as usual.
          </div>
        )}

        {stepIndex > 0 && <AnsweredRow id="where" label="Where and when" value={`${venue?.name ?? ''} · ${formatDate(date)} · ${courtNames}`} onChange={() => go('where')} />}
        {stepIndex > 1 && <AnsweredRow id="size" label="How big is the day" value={`${expected} players · ${hm(minutes)} · ${goalLabel}`} onChange={() => go('size')} />}
        {stepIndex > 2 && <AnsweredRow id="format" label="Format" value={info.name} onChange={() => go('format')} />}
        {stepIndex > 3 && <AnsweredRow id="fine" label="Details" value={`${shownName.trim() || info.name} · ${est.summary}`} onChange={() => go('fine')} />}

        {/* 1 · where and when */}
        {step === 'where' && (
          <AskCard {...open('where')} subtitle="The club, the day, and the courts you will use.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <FlowButton onClick={nextStep} disabled={!whereReady} testId="flow-continue">Continue</FlowButton>
          </AskCard>
        )}

        {/* 2 · how big is the day */}
        {step === 'size' && (
          <AskCard {...open('size')} subtitle="Tell us about the day and we suggest the formats that suit it.">
            <div data-testid="helper" className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            </div>
            <FlowButton onClick={nextStep} testId="flow-continue">Continue</FlowButton>
          </AskCard>
        )}

        {/* 3 · the format */}
        {step === 'format' && (
          <AskCard {...open('format')} subtitle={`${showAll ? 'Every format.' : `Suggested for ${planPlayers} players and ${hm(minutes)}.`} Tap one to choose it.`}>
            {!showAll && (
              <div className="flex flex-col gap-2.5" data-testid="recs">
                {ladderRec && (
                  <a href={ladderRec.href} data-testid="rec-ladder" className="block rounded-xl p-3.5" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Ladder</span>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{joinReasons(ladderRec.reasons)}. Opens the ladders page.</p>
                  </a>
                )}
                {shownIds.map(id => {
                  const f = formatInfo(id)!
                  const r = recFormats.find(x => x.id === id)
                  return (
                    <FormatCard key={id} testId={`rec-${id}`} name={f.name} blurb={f.blurb} note={r ? joinReasons(r.reasons) : undefined}
                      tag={fitTag(id)} on={format === id} disabled={!usable(id)} badge={f.ready && !usable(id) ? 'Setup needed' : undefined} onClick={() => setFormat(id)} />
                  )
                })}
              </div>
            )}

            {showAll && (
              <div className="flex flex-col gap-4">
                {(['social', 'comp'] as const).map(g => (
                  <div key={g}>
                    <h3 className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>{GROUP_LABEL[g]}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {FORMATS.filter(f => f.group === g).map(f => {
                        const can = usable(f.id)
                        const outOfRange = f.ready && !estimate(f.id, plan, normalizeSettings(f.id, {})).inRange
                        return (
                          <FormatCard key={f.id} testId={`fmt-${f.id}`} name={f.name} blurb={f.blurb}
                            note={outOfRange ? `Better with ${f.need[0]} to ${f.need[1]} ${f.unit}` : undefined}
                            tag={fitTag(f.id)} on={format === f.id} disabled={!can}
                            badge={!f.ready ? 'Coming soon' : !can ? 'Setup needed' : undefined} onClick={() => setFormat(f.id)} />
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button type="button" onClick={() => setShowAll(v => !v)} data-testid="see-all-formats" className="text-[13px] font-bold self-start" style={{ color: 'var(--brand-primary-text)' }}>
              {showAll ? '‹ Back to the suggestions' : `See all ${FORMATS.length} formats ›`}
            </button>
            <FlowButton onClick={nextStep} disabled={!usable(format)} testId="flow-continue">Continue with {info.name}</FlowButton>
          </AskCard>
        )}

        {/* 4 · fine-tune */}
        {step === 'fine' && (
          <AskCard {...open('fine')} subtitle="Already filled in for you. Change anything, or just continue.">
            <div>
              <h3 className="text-lg" style={{ ...display, color: 'var(--text-primary)' }}>{info.name}</h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{info.blurb}</p>
            </div>
            {field('Name', <input type="text" className="input text-sm" value={shownName} onChange={e => { setName(e.target.value); setNameTouched(true) }} data-testid="name" />)}
            {isRotationFormat(format) ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {field('Points to win', <input type="number" min={1} className="input text-sm" value={pointsToWin} onChange={e => setPointsToWin(Number(e.target.value))} />)}
                {field('Rounds', <input type="number" min={1} max={30} className="input text-sm" value={totalRounds} onChange={e => setRounds(Number(e.target.value))} data-testid="rounds" />)}
                {field('Round length', (
                  <select className="input text-sm" value={roundMinutes} onChange={e => setRoundMinutes(Number(e.target.value))}>
                    {[10, 12, 15, 20, 25, 30].map(v => <option key={v} value={v}>{v} min</option>)}
                  </select>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Pairs per group</label>
                  <div className="flex gap-1.5">{([3, 4, 5] as const).map(v => <Chip key={v} on={groupSize === v} onClick={() => setGroupSize(v)} data-testid={`group-size-${v}`}>{v}</Chip>)}</div>
                </div>
                <div>
                  <label className="label">Through from each group</label>
                  <div className="flex gap-1.5">{([2, 1] as const).map(v => <Chip key={v} on={advance === v} onClick={() => setAdvance(v)} data-testid={`advance-${v}`}>{v === 2 ? 'Top 2' : 'Top 1'}</Chip>)}</div>
                </div>
                <div className="sm:col-span-2">
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
            <FlowButton onClick={nextStep} testId="flow-continue">Continue</FlowButton>
          </AskCard>
        )}

        {/* 5 · who is playing, and create */}
        {step === 'players' && (
          <AskCard {...open('players')} subtitle="Add club members and guests. You can add more once it is created.">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-extrabold uppercase tracking-wide" style={{ color: 'var(--text-primary)' }}>Players ({rosterCount})</h3>
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
            <FlowButton onClick={create} disabled={saving || !usable(format)} testId="create-tournament">{saving ? 'Creating…' : 'Create tournament'}</FlowButton>
            {isPairFormat(format) && <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>Next you will make the pairs: a random draw, balanced by level, or picked by hand.</p>}
          </AskCard>
        )}

        {STEPS.filter(s => STEPS.indexOf(s) > stepIndex).map(s => <LaterRow key={s} id={s} label={LABEL[s]} />)}
      </div>
    </div>
  )
}
