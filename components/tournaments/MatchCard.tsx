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

const stepBtn = { border: '1px solid var(--border)', color: 'var(--text-muted)', background: 'transparent' } as const
const display = { fontFamily: 'var(--font-display), Manrope, sans-serif', fontWeight: 500 } as const

// One match: who is playing, where, and either the score or boxes to enter it.
export default function MatchCard({
  m, canScore, noTies, submitting, onSubmit, canEdit = false, onEdit,
}: {
  m: MatchCardData; canScore: boolean; noTies: boolean; submitting: boolean; onSubmit: (id: string, s1: number, s2: number) => void
  canEdit?: boolean; onEdit?: (id: string, s1: number, s2: number) => void
}) {
  const [t1, setT1] = useState('')
  const [t2, setT2] = useState('')
  const [problem, setProblem] = useState('')
  const [editing, setEditing] = useState(false)

  const submit = () => {
    const a = Number(t1), b = Number(t2)
    if (t1 === '' || t2 === '' || !Number.isInteger(a) || !Number.isInteger(b)) { setProblem('Enter both scores as whole numbers.'); return }
    if (a < 0 || b < 0) { setProblem('Scores cannot be negative.'); return }
    if (noTies && a === b) { setProblem('A knockout match needs a winner.'); return }
    setProblem('')
    if (editing) { onEdit?.(m.id, a, b); setEditing(false) } else onSubmit(m.id, a, b)
  }
  const startEdit = () => { setT1(String(m.score1 ?? '')); setT2(String(m.score2 ?? '')); setProblem(''); setEditing(true) }
  const ready = t1 !== '' && t2 !== ''
  const courtNo = /^Court\s+(\d+)$/i.exec(m.court.trim())?.[1] ?? null
  const win1 = m.done && (m.score1 ?? 0) > (m.score2 ?? 0), win2 = m.done && (m.score2 ?? 0) > (m.score1 ?? 0)
  const side = (name: string, score: number | null, wins: boolean, value: string, set: (v: string) => void, which: 1 | 2) => (
    <div className="flex items-center justify-between gap-2" style={{ marginTop: which === 2 ? 6 : 0 }}>
      <div className="text-sm min-w-0 truncate" style={{ color: 'var(--text-primary)', fontWeight: wins ? 700 : 600 }}>{name}</div>
      {m.done && !editing ? (
        <div className="text-lg shrink-0" style={{ ...display, color: wins ? 'var(--brand-primary-text)' : 'var(--text-muted)' }} data-testid={`score-${which}`}>{score}</div>
      ) : canScore || editing ? (
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" tabIndex={-1} aria-label={`Take a point off ${name}`} className="hidden md:grid h-8 w-8 place-items-center rounded-full text-base" style={stepBtn}
            onClick={() => set(String(Math.max(0, (Number(value) || 0) - 1)))}>−</button>
          <input type="number" inputMode="numeric" min={0} className="input text-sm text-center md:text-lg md:font-bold md:[appearance:textfield] md:[&::-webkit-inner-spin-button]:appearance-none md:[&::-webkit-outer-spin-button]:appearance-none" style={{ width: 60 }} value={value} aria-label={`${name} score`}
            onChange={e => set(e.target.value)} data-testid={`input-${which}`} />
          <button type="button" tabIndex={-1} aria-label={`Add a point to ${name}`} className="hidden md:grid h-8 w-8 place-items-center rounded-full text-base" style={stepBtn}
            onClick={() => set(String((Number(value) || 0) + 1))}>+</button>
        </div>
      ) : null}
    </div>
  )
  return (
    <div className="rounded-2xl p-3.5 md:p-4 md:grid md:grid-cols-[72px_minmax(0,1fr)] md:gap-4 md:items-start" data-testid="match-card" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
      <div className="hidden md:flex flex-col items-center justify-center rounded-[14px] h-16 text-white text-center px-1" aria-hidden style={{ background: 'linear-gradient(160deg,#2c5fc4,#1d3f8d)' }}>
        {courtNo ? (<><span className="text-[9px] font-bold tracking-[0.12em] opacity-80">COURT</span><span className="text-[26px] font-bold leading-none">{courtNo}</span></>) : <span className="text-xs font-bold leading-tight">{m.court}</span>}
      </div>
      <div className="min-w-0">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{m.heading}</span>
        <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}><span className="md:hidden">{m.court}</span>{m.later ? <span><span className="md:hidden"> · </span>later slot</span> : null}</span>
      </div>
      {side(m.team1, m.score1, win1, t1, setT1, 1)}
      <div className="hidden md:block text-[10px] font-bold tracking-[0.12em] my-0.5" style={{ color: 'var(--text-subtle)' }} aria-hidden>VS</div>
      {side(m.team2, m.score2, win2, t2, setT2, 2)}
      {m.done && !editing && !win1 && !win2 && <div className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>Draw</div>}
      {m.done && !editing && canEdit && onEdit && (
        <button type="button" onClick={startEdit} className="mt-2 text-xs font-bold" style={{ color: 'var(--brand-primary-text)' }} data-testid="edit-score">Edit score</button>
      )}
      {m.done && editing && (
        <>
          {problem && <p role="alert" className="text-xs mt-2" style={{ color: 'var(--brand-crimson)' }}>{problem}</p>}
          <div className="flex gap-2 mt-2">
            <button type="button" className="btn btn-primary btn-sm flex-1 justify-center" onClick={submit} data-testid="save-edit">Save correction</button>
            <button type="button" className="btn btn-sm justify-center" onClick={() => { setEditing(false); setProblem('') }} data-testid="cancel-edit">Cancel</button>
          </div>
        </>
      )}
      {!m.done && canScore && (
        <>
          {problem && <p role="alert" className="text-xs mt-2" style={{ color: 'var(--brand-crimson)' }}>{problem}</p>}
          <button className={`btn btn-primary btn-sm w-full justify-center mt-2${ready ? '' : ' md:!bg-none md:!bg-transparent md:!text-[var(--text-muted)] md:!border md:!border-[var(--border)] md:!shadow-none'}`} disabled={submitting} onClick={submit} data-testid="confirm-score">
            {submitting ? 'Saving…' : 'Confirm score'}
          </button>
        </>
      )}
      {!m.done && !canScore && <div className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Waiting for the score</div>}
      </div>
    </div>
  )
}
