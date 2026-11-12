'use client'

import { useState } from 'react'

export type MatchCardData = {
  id: string
  heading: string // "Group A", "Semi-final", "Round 2"
  court: string
  later: boolean // second or later time slot on the courts
  team1: string
  team2: string
  score1: number | null
  score2: number | null
  done: boolean
}

const display = { fontFamily: 'var(--font-display), Manrope, sans-serif', fontWeight: 500 } as const

// One match: who is playing, where, and either the score or boxes to enter it.
export default function MatchCard({
  m, canScore, noTies, submitting, onSubmit,
}: { m: MatchCardData; canScore: boolean; noTies: boolean; submitting: boolean; onSubmit: (id: string, s1: number, s2: number) => void }) {
  const [t1, setT1] = useState('')
  const [t2, setT2] = useState('')
  const [problem, setProblem] = useState('')

  const submit = () => {
    const a = Number(t1), b = Number(t2)
    if (t1 === '' || t2 === '' || !Number.isInteger(a) || !Number.isInteger(b)) { setProblem('Enter both scores as whole numbers.'); return }
    if (a < 0 || b < 0) { setProblem('Scores cannot be negative.'); return }
    if (noTies && a === b) { setProblem('A knockout match needs a winner.'); return }
    setProblem('')
    onSubmit(m.id, a, b)
  }
  const win1 = m.done && (m.score1 ?? 0) > (m.score2 ?? 0), win2 = m.done && (m.score2 ?? 0) > (m.score1 ?? 0)
  const side = (name: string, score: number | null, wins: boolean, value: string, set: (v: string) => void, which: 1 | 2) => (
    <div className="flex items-center justify-between gap-2" style={{ marginTop: which === 2 ? 6 : 0 }}>
      <div className="text-sm min-w-0 truncate" style={{ color: 'var(--text-primary)', fontWeight: wins ? 700 : 600 }}>{name}</div>
      {m.done ? (
        <div className="text-lg shrink-0" style={{ ...display, color: wins ? 'var(--brand-primary-text)' : 'var(--text-muted)' }} data-testid={`score-${which}`}>{score}</div>
      ) : canScore ? (
        <input type="number" inputMode="numeric" min={0} className="input text-sm text-center" style={{ width: 60 }} value={value} aria-label={`${name} score`}
          onChange={e => set(e.target.value)} data-testid={`input-${which}`} />
      ) : null}
    </div>
  )
  return (
    <div className="rounded-2xl p-3.5" data-testid="match-card" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{m.heading}</span>
        <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{m.court}{m.later ? ' · later slot' : ''}</span>
      </div>
      {side(m.team1, m.score1, win1, t1, setT1, 1)}
      {side(m.team2, m.score2, win2, t2, setT2, 2)}
      {m.done && !win1 && !win2 && <div className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>Draw</div>}
      {!m.done && canScore && (
        <>
          {problem && <p role="alert" className="text-xs mt-2" style={{ color: 'var(--brand-crimson)' }}>{problem}</p>}
          <button className="btn btn-primary btn-sm w-full justify-center mt-2" disabled={submitting} onClick={submit} data-testid="confirm-score">
            {submitting ? 'Saving…' : 'Confirm score'}
          </button>
        </>
      )}
      {!m.done && !canScore && <div className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Waiting for the score</div>}
    </div>
  )
}
