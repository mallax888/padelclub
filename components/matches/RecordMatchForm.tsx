'use client'

import { useState, useEffect, useId } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { AnsweredRow, AskCard, FlowButton, FlowProgress, FLOW_FRAME } from '@/components/ui/PromptFlow'

type Player = { id: string; full_name: string | null; nickname: string | null; ranking_points: number | null }
type SetScore = { t1: number; t2: number }
type Step = 'who' | 'score' | 'check'

const POINTS = { win: 10, loss: 2, win_bonus: 5 }
const STEPS: Step[] = ['who', 'score', 'check']
const LABEL: Record<Step, string> = { who: 'Who played?', score: 'What was the score?', check: 'Check it over' }

function isValidSet(t1: number, t2: number): boolean {
  if (t1 === t2) return false
  const hi = Math.max(t1, t2)
  const lo = Math.min(t1, t2)
  if (hi === 7 && lo === 6) return true
  if (hi === 7) return false
  if (hi === 6 && lo <= 5) return true
  return false
}

function setWinner(s: SetScore): 1 | 2 { return s.t1 > s.t2 ? 1 : 2 }
function setsWon(sets: SetScore[], team: 1 | 2) { return sets.filter(s => setWinner(s) === team).length }

// A padel racket, not a tennis one (option H): a wide rounded face with nine holes and the open
// triangle throat, a dark grip with a lime tip. Blue gradient face with a soft shine, like the
// court and date tiles. Ids come from useId so two rackets on one page never share a gradient.
const RACKET_FACE = 'M24 2.5 C33.5 2.5 39.5 9 39.5 17.5 C39.5 25.5 34 30.5 28.2 32.4 L26.8 36 L21.2 36 L19.8 32.4 C14 30.5 8.5 25.5 8.5 17.5 C8.5 9 14.5 2.5 24 2.5 Z'
const RACKET_HOLES = [-5, 0, 5].flatMap(y => [-5, 0, 5].map(x => [24 + x, 16 + y] as const))
function RacketBody() {
  const id = useId().replace(/:/g, '')
  return (
    <>
      <defs>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5b8ff0" /><stop offset=".55" stopColor="#2c5fc4" /><stop offset="1" stopColor="#173678" />
        </linearGradient>
        <filter id={`${id}s`} x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="1.6" floodColor="#000" floodOpacity=".35" /></filter>
        <mask id={`${id}m`}><rect width="48" height="48" fill="#fff" /><path d="M24 27.2 L26.6 33 L21.4 33 Z" fill="#000" /></mask>
      </defs>
      <g filter={`url(#${id}s)`} mask={`url(#${id}m)`}>
        <path d={RACKET_FACE} fill={`url(#${id}f)`} />
        {RACKET_HOLES.map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.6" fill="#0f2a66" />)}
        <ellipse cx="19" cy="9" rx="8" ry="4.2" fill="#ffffff" opacity=".28" transform="rotate(-25 19 9)" />
        <rect x="20.6" y="35" width="6.8" height="11.5" rx="3.4" fill="#141a22" />
        <rect x="20.6" y="42.5" width="6.8" height="4" rx="2" fill="#d4f53c" />
      </g>
    </>
  )
}
function Racket() {
  return <svg width="46" height="46" viewBox="0 0 48 48" aria-hidden><RacketBody /></svg>
}
// Two of them fanned out from the grips, for doubles.
function RacketPair() {
  return (
    <svg width="70" height="46" viewBox="-6 0 60 48" aria-hidden>
      <g transform="rotate(-16 24 40) translate(-7 0)"><RacketBody /></g>
      <g transform="rotate(16 24 40) translate(7 0)"><RacketBody /></g>
    </svg>
  )
}

// Declared at module level, not inside RecordMatchForm: a component defined during render
// gets a fresh identity on every render, so React tears the old one down and mounts a new
// one each time any state changes -- which for a <select> means it loses focus mid-interaction.
function ScoreStepper({ value, onChange, color, label }: { value: number; onChange: (n: number) => void; color: string; label: string }) {
  const dec = () => { if (value > 0) onChange(value - 1) }
  const inc = () => { if (value < 7) onChange(value + 1) }
  return (
    <div className="flex items-center justify-center gap-2" style={{ flex: 1, height: 84, borderRadius: 12, background: 'var(--bg-surface)', border: `1.5px solid ${color}` }}>
      <button
        type="button" onClick={dec} disabled={value <= 0} aria-label={`${label} minus one`}
        className="flex items-center justify-center rounded-lg"
        style={{ width: 36, height: 36, fontSize: 20, fontWeight: 700, color, border: `1px solid ${color}`, background: 'var(--bg-raised)', opacity: value <= 0 ? 0.35 : 1, cursor: value <= 0 ? 'not-allowed' : 'pointer' }}
      >
        −
      </button>
      <div style={{ width: 52, textAlign: 'center', fontSize: 40, fontWeight: 900, fontVariantNumeric: 'tabular-nums', color }} aria-label={`${label} score`}>{value}</div>
      <button
        type="button" onClick={inc} disabled={value >= 7} aria-label={`${label} plus one`}
        className="flex items-center justify-center rounded-lg"
        style={{ width: 36, height: 36, fontSize: 20, fontWeight: 700, color, border: `1px solid ${color}`, background: 'var(--bg-raised)', opacity: value >= 7 ? 0.35 : 1, cursor: value >= 7 ? 'not-allowed' : 'pointer' }}
      >
        +
      </button>
    </div>
  )
}

function PlayerSelect({ players, value, onChange, exclude, label }: {
  players: Player[]
  value: string
  onChange: (v: string) => void
  exclude: string[]
  label: string
}) {
  return (
    <select className="input text-sm" value={value} onChange={e => onChange(e.target.value)} aria-label={label}>
      <option value="">— select —</option>
      {players.filter(p => !exclude.filter(Boolean).includes(p.id) || p.id === value).map(p => (
        <option key={p.id} value={p.id}>{p.nickname ?? p.full_name}</option>
      ))}
    </select>
  )
}

export default function RecordMatchForm({
  players,
  currentUserId,
  prefill = null,
}: {
  players: Player[]
  currentUserId: string
  prefill?: { label: string; playerIds: string[] } | null
}) {
  const supabase = createClient()
  const router = useRouter()

  // Four from a booking is doubles; two is singles. Three means somebody
  // pulled out and wasn't replaced, so the format is left on doubles and the
  // empty slot is for the person to fill in.
  const [format, setFormat] = useState<'doubles' | 'singles'>(
    prefill?.playerIds.length === 2 ? 'singles' : 'doubles',
  )
  // Teams are a guess, not a fact: the booking records who played, never which
  // pair they played in. Organiser and the next seat form Team 1 because the
  // organiser is usually one of them -- and all four are editable.
  const singlesPrefill = prefill?.playerIds.length === 2
  const [team1p1, setTeam1p1] = useState(prefill?.playerIds[0] ?? '')
  const [team1p2, setTeam1p2] = useState(singlesPrefill ? '' : prefill?.playerIds[1] ?? '')
  const [team2p1, setTeam2p1] = useState(singlesPrefill ? prefill?.playerIds[1] ?? '' : prefill?.playerIds[2] ?? '')
  const [team2p2, setTeam2p2] = useState(prefill?.playerIds[3] ?? '')

  // From a booking with everyone filled in, the first question is already answered, so the
  // page opens on the score. With a seat missing it opens on Who played so it can be filled.
  const [step, setStep] = useState<Step>(() => {
    const n = prefill?.playerIds.length ?? 0
    return n === 2 || n >= 4 ? 'score' : 'who'
  })

  const changeFormat = (f: 'doubles' | 'singles') => {
    setFormat(f)
    if (f === 'singles') {
      setTeam1p2('')
      setTeam2p2('')
    }
  }
  const [sets, setSets] = useState<SetScore[]>([])
  const [editingSet, setEditingSet] = useState<number | null>(null)
  const [draftT1, setDraftT1] = useState(0)
  const [draftT2, setDraftT2] = useState(0)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // One key per mounted form instance -- a double-submit (double click, a
  // retried request) reuses the same key so the server can tell it's the
  // same submission instead of a second match.
  const [idempotencyKey] = useState(() => crypto.randomUUID())

  const w1 = setsWon(sets, 1)
  const w2 = setsWon(sets, 2)
  const matchWinner = w1 === 2 ? 1 : w2 === 2 ? 2 : null
  const needsSet3 = sets.length === 2 && w1 === 1 && w2 === 1
  const setsToShow = matchWinner
    ? sets.length
    : Math.min(sets.length + 1, needsSet3 || sets.length === 3 ? 3 : 2)
  const activeSetIndex = editingSet !== null
    ? editingSet
    : Array.from({ length: setsToShow }, (_, i) => i).find(i => sets[i] === undefined) ?? null

  // Confirming a set doesn't explicitly reset the draft score (openSet does
  // that for a manual re-edit), so without this, auto-advancing to the next
  // set after a confirm would leave the previous set's numbers sitting in
  // the stepper.
  useEffect(() => {
    if (activeSetIndex !== null) {
      setDraftT1(sets[activeSetIndex]?.t1 ?? 0)
      setDraftT2(sets[activeSetIndex]?.t2 ?? 0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSetIndex])

  const playerLabel = (id: string) => {
    const p = players.find(pl => pl.id === id)
    return p ? (p.nickname ?? p.full_name ?? 'Player') : null
  }
  const teamName = (a: string, b: string, fallback: string) => {
    const names = [playerLabel(a), playerLabel(b)].filter(Boolean) as string[]
    return names.length ? names.join(' & ') : fallback
  }
  const team1Name = teamName(team1p1, team1p2, 'Team 1')
  const team2Name = teamName(team2p1, team2p2, 'Team 2')

  const openSet = (setIndex: number) => {
    if (editingSet === setIndex) {
      setEditingSet(null)
    } else {
      setEditingSet(setIndex)
      setDraftT1(sets[setIndex]?.t1 ?? 0)
      setDraftT2(sets[setIndex]?.t2 ?? 0)
    }
  }

  const confirmSet = (setIndex: number) => {
    if (!isValidSet(draftT1, draftT2)) {
      toast.error(`${draftT1}–${draftT2} is not a valid padel score`)
      return
    }
    const newSets = [...sets]
    newSets[setIndex] = { t1: draftT1, t2: draftT2 }
    const kept = newSets.slice(0, setIndex + 1)
    setSets(kept)
    setEditingSet(null)
    // the next set starts at 0–0 straight away, not a frame later
    setDraftT1(0)
    setDraftT2(0)
    // The second set won ends the match, so the next question opens by itself.
    if (setsWon(kept, 1) === 2 || setsWon(kept, 2) === 2) setStep('check')
  }

  const handleSubmit = async () => {
    if (!team1p1 || !team2p1) { toast.error('Please select at least one player per team'); return }
    if (!matchWinner) { toast.error('Match is not complete yet'); return }
    setSubmitting(true)

    const res = await fetch('/api/record-match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team1p1, team1p2, team2p1, team2p2, sets, matchWinner, notes, idempotencyKey }),
    })
    await res.json().catch(() => ({}))

    if (!res.ok) {
      toast.error('Could not record match. Please try again.')
      setSubmitting(false)
      return
    }

    toast.success('Match recorded! Leaderboard updated.')
    router.push('/players')
    router.refresh()
    setSubmitting(false)
  }

  const draftValid = isValidSet(draftT1, draftT2)
  const whoReady = !!team1p1 && !!team2p1
  const whoValue = `${format === 'doubles' ? 'Doubles' : 'Singles'} · ${team1Name} vs ${team2Name}`
  const scoreText = sets.map(s => `${s.t1}–${s.t2}`).join(', ')
  const winnerName = matchWinner === 1 ? team1Name : matchWinner === 2 ? team2Name : ''
  const promptNo = STEPS.indexOf(step) + 1
  const goScore = () => setStep(matchWinner ? 'check' : 'score')

  const teamBlock = (n: 1 | 2) => {
    const p1 = n === 1 ? team1p1 : team2p1
    const p2 = n === 1 ? team1p2 : team2p2
    const setP1 = n === 1 ? setTeam1p1 : setTeam2p1
    const setP2 = n === 1 ? setTeam1p2 : setTeam2p2
    const others = n === 1 ? [team2p1, team2p2] : [team1p1, team1p2]
    return (
      <div data-testid={`team-${n}`}>
        <div className="text-xs font-extrabold uppercase tracking-wide mb-2" style={{ color: n === 1 ? 'var(--brand-primary-text)' : 'var(--team2)' }}>Team {n}</div>
        <div className={`grid gap-3 ${format === 'doubles' ? 'sm:grid-cols-2' : ''}`}>
          <PlayerSelect players={players} value={p1} onChange={setP1} exclude={[p2, ...others]} label={`Team ${n} player 1`} />
          {format === 'doubles' && <PlayerSelect players={players} value={p2} onChange={setP2} exclude={[p1, ...others]} label={`Team ${n} player 2`} />}
        </div>
      </div>
    )
  }

  return (
    <div className={FLOW_FRAME}>
      <FlowProgress total={STEPS.length} current={promptNo} />
      <div className="flex flex-col gap-4">
        {prefill && (
          <div className="rounded-[20px] px-4 py-3.5 flex items-center gap-3" data-testid="booking-banner"
            style={{ background: 'var(--brand-primary-muted)', border: '1px solid var(--brand-primary)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--brand-primary-text)', flexShrink: 0 }}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>
            <span className="min-w-0">
              <span className="block text-[11px] font-extrabold uppercase" style={{ letterSpacing: '0.1em', color: 'var(--brand-primary-text)' }}>From your booking</span>
              <span className="block text-[15px] font-bold truncate" style={{ color: 'var(--text-primary)' }}>{prefill.label}</span>
            </span>
          </div>
        )}

        {step !== 'who' && <AnsweredRow id="who" label="Who played" value={whoValue} onChange={() => setStep('who')} />}
        {step === 'check' && <AnsweredRow id="score" label="Score" value={`${winnerName} win ${scoreText}`} onChange={() => setStep('score')} />}

        {step === 'who' && (
          <AskCard n={promptNo} total={STEPS.length} title={LABEL.who} subtitle={prefill ? 'Filled in from your booking. Change any of them.' : 'Pick the players on each side.'}>
            <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Format" data-testid="format">
              {([
                { value: 'doubles' as const, label: 'Doubles', desc: '2 vs 2', icon: <RacketPair /> },
                { value: 'singles' as const, label: 'Singles', desc: '1 vs 1', icon: <Racket /> },
              ]).map(f => (
                <button key={f.value} type="button" role="radio" aria-checked={format === f.value} onClick={() => changeFormat(f.value)}
                  className="flex flex-col items-center justify-center text-center px-3 py-3 rounded-xl transition-all"
                  style={{
                    // Picked turns white (ink on the light theme), never a blue ring on a blue button.
                    background: format === f.value ? 'var(--today-block-bg)' : 'var(--bg-raised)',
                    border: `1px solid ${format === f.value ? 'transparent' : 'var(--border)'}`,
                    boxShadow: format === f.value ? 'var(--today-block-shadow)' : 'none',
                    color: format === f.value ? 'var(--today-block-fg)' : 'var(--text-primary)',
                  }}>
                  <div className="leading-none mb-1.5 flex items-end justify-center" style={{ height: 48 }}>{f.icon}</div>
                  <div className="text-base font-bold" style={{ color: format === f.value ? 'var(--today-block-fg)' : 'var(--text-primary)' }}>{f.label}</div>
                  <div className="text-xs mt-0.5 font-semibold" style={{ color: format === f.value ? 'var(--today-block-fg)' : 'var(--text-muted)' }}>{f.desc}</div>
                </button>
              ))}
            </div>
            {teamBlock(1)}
            {teamBlock(2)}
            <FlowButton onClick={goScore} disabled={!whoReady} testId="flow-continue">Continue</FlowButton>
          </AskCard>
        )}

        {step === 'score' && (
          <AskCard n={promptNo} total={STEPS.length} title={LABEL.score} subtitle="Set by set. The match ends when one side wins two sets.">
            {sets.some((s, i) => s !== undefined && i !== activeSetIndex) && (
              <div className="flex flex-wrap gap-2" data-testid="set-chips">
                {sets.map((score, i) => i === activeSetIndex ? null : (
                  <button key={i} type="button" onClick={() => openSet(i)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                    style={{ background: setWinner(score) === 1 ? 'var(--brand-primary-muted)' : 'var(--team2-muted)', color: setWinner(score) === 1 ? 'var(--brand-primary-text)' : 'var(--team2)' }}>
                    Set {i + 1}: {score.t1}–{score.t2}
                  </button>
                ))}
              </div>
            )}

            {activeSetIndex !== null && (
              <div data-testid="set-entry">
                <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Set {activeSetIndex + 1}</div>
                <div className="flex items-center gap-2 mb-2 text-sm font-bold">
                  <span className="flex-1 text-center truncate" style={{ color: 'var(--brand-primary-text)' }}>{team1Name}</span>
                  <span className="w-8" />
                  <span className="flex-1 text-center truncate" style={{ color: 'var(--team2)' }}>{team2Name}</span>
                </div>
                <div className="flex items-center justify-center gap-4 mb-3">
                  <ScoreStepper value={draftT1} onChange={setDraftT1} color="var(--brand-primary-text)" label="Team 1" />
                  <span style={{ fontSize: 22, fontWeight: 200, color: 'var(--text-muted)' }}>–</span>
                  <ScoreStepper value={draftT2} onChange={setDraftT2} color="var(--team2)" label="Team 2" />
                </div>
                <div className="text-center text-xs font-medium mb-3" data-testid="set-hint" style={{ color: draftValid ? 'var(--brand-primary-text)' : 'var(--text-muted)' }}>
                  {draftT1 === draftT2 ? 'Scores can’t be tied' : draftValid ? `Valid — ${draftT1 > draftT2 ? team1Name : team2Name} win this set` : 'Not a valid padel score yet'}
                </div>
                <FlowButton onClick={() => confirmSet(activeSetIndex)} disabled={!draftValid} testId="confirm-set">Confirm set {activeSetIndex + 1}</FlowButton>
              </div>
            )}

            {matchWinner && activeSetIndex === null && (
              <>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Tap a set to change its score.</p>
                <FlowButton onClick={() => setStep('check')} testId="flow-continue">Continue</FlowButton>
              </>
            )}
          </AskCard>
        )}

        {step === 'check' && (
          <AskCard n={promptNo} total={STEPS.length} title={LABEL.check} subtitle="This updates the leaderboard straight away.">
            {matchWinner && (
              <div className="text-center text-sm font-semibold py-3 rounded-xl" data-testid="result"
                style={{ background: matchWinner === 1 ? 'var(--brand-primary-muted)' : 'var(--team2-muted)', color: matchWinner === 1 ? 'var(--brand-primary-text)' : 'var(--team2)', border: `1px solid ${matchWinner === 1 ? 'var(--brand-primary)' : 'var(--team2)'}` }}>
                🏆 {winnerName} win {scoreText}
              </div>
            )}
            <div className="rounded-xl p-3 text-xs font-semibold" data-testid="points" style={{ background: 'var(--bg-raised)', color: 'var(--text-primary)' }}>
              Winners +{POINTS.win}{sets.length === 2 ? ` +${POINTS.win_bonus} bonus` : ''} pts · Losers +{POINTS.loss} pts
            </div>
            <div>
              <label className="label">Notes (optional)</label>
              <textarea className="input text-sm" rows={2} placeholder="Any notes about the match..." value={notes} onChange={e => setNotes(e.target.value)} maxLength={200} />
            </div>
            <FlowButton onClick={handleSubmit} disabled={submitting || !team1p1 || !team2p1 || !matchWinner} testId="record-match">
              {submitting ? 'Recording...' : 'Record match & update leaderboard'}
            </FlowButton>
          </AskCard>
        )}

      </div>
    </div>
  )
}
