'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { AnsweredRow, AskCard, FlowButton, FlowProgress, LaterRow, FLOW_FRAME } from '@/components/ui/PromptFlow'

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

// A padel racket, not a tennis one: solid perforated head, no strings, short
// handle. Drawn rather than borrowed from an emoji because the closest ones
// available are a tennis racket, a ping-pong bat and a badminton racket --
// all of them the wrong sport on a padel app. Strokes use currentColor so the
// icon follows the button's selected state like every other icon here.
function Racket({ size = 22, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden>
      <ellipse cx="12" cy="8.4" rx="5.9" ry="6.6" />
      <path d="M12 15v5.4" />
      <path d="M10.4 20.8h3.2" />
      <circle cx="9.7" cy="7" r="0.85" fill="currentColor" stroke="none" />
      <circle cx="14.3" cy="7" r="0.85" fill="currentColor" stroke="none" />
      <circle cx="12" cy="10.6" r="0.85" fill="currentColor" stroke="none" />
    </svg>
  )
}

// Two of them, leaning apart the way a pair sits on a bench. Offset as well as
// rotated so the heads read as two separate rackets rather than one thick one.
function RacketPair() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'flex-end' }}>
      <Racket size={22} style={{ transform: 'rotate(-20deg)', marginRight: -9 }} />
      <Racket size={22} style={{ transform: 'rotate(20deg)' }} />
    </span>
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
  const later = STEPS.filter(s => STEPS.indexOf(s) > STEPS.indexOf(step))

  const teamBlock = (n: 1 | 2) => {
    const p1 = n === 1 ? team1p1 : team2p1
    const p2 = n === 1 ? team1p2 : team2p2
    const setP1 = n === 1 ? setTeam1p1 : setTeam2p1
    const setP2 = n === 1 ? setTeam1p2 : setTeam2p2
    const others = n === 1 ? [team2p1, team2p2] : [team1p1, team1p2]
    return (
      <div data-testid={`team-${n}`}>
        <div className="text-xs font-extrabold uppercase tracking-wide mb-2" style={{ color: n === 1 ? 'var(--brand-primary-text)' : 'var(--brand-accent)' }}>Team {n}</div>
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
                    background: format === f.value ? 'var(--brand-primary-muted)' : 'var(--bg-raised)',
                    border: `1px solid ${format === f.value ? 'var(--brand-primary)' : 'var(--border)'}`,
                    boxShadow: format === f.value ? 'var(--glow-primary)' : 'none',
                  }}>
                  <div className="leading-none mb-1" style={{ color: format === f.value ? 'var(--brand-primary-text)' : 'var(--text-muted)' }}>{f.icon}</div>
                  <div className="text-base font-bold" style={{ color: format === f.value ? 'var(--brand-primary-text)' : 'var(--text-primary)' }}>{f.label}</div>
                  <div className="text-xs mt-0.5 font-semibold" style={{ color: format === f.value ? 'var(--brand-primary-text)' : 'var(--text-muted)', opacity: format === f.value ? 0.85 : 1 }}>{f.desc}</div>
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
                    style={{ background: setWinner(score) === 1 ? 'var(--brand-primary-muted)' : 'var(--brand-accent-muted)', color: setWinner(score) === 1 ? 'var(--brand-primary-text)' : 'var(--brand-accent)' }}>
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
                  <span className="flex-1 text-center truncate" style={{ color: 'var(--brand-accent)' }}>{team2Name}</span>
                </div>
                <div className="flex items-center justify-center gap-4 mb-3">
                  <ScoreStepper value={draftT1} onChange={setDraftT1} color="var(--brand-primary-text)" label="Team 1" />
                  <span style={{ fontSize: 22, fontWeight: 200, color: 'var(--text-muted)' }}>–</span>
                  <ScoreStepper value={draftT2} onChange={setDraftT2} color="var(--brand-accent)" label="Team 2" />
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
                style={{ background: matchWinner === 1 ? 'var(--brand-primary-muted)' : 'var(--brand-accent-muted)', color: matchWinner === 1 ? 'var(--brand-primary-text)' : 'var(--brand-accent)', border: `1px solid ${matchWinner === 1 ? 'var(--brand-primary)' : 'var(--brand-accent)'}` }}>
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

        {later.map(s => <LaterRow key={s} id={s} label={LABEL[s]} />)}
      </div>
    </div>
  )
}
