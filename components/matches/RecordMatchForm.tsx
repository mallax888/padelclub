'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

type Player = { id: string; full_name: string | null; nickname: string | null; ranking_points: number | null }
type SetScore = { t1: number; t2: number }

const POINTS = { win: 10, loss: 2, win_bonus: 5 }

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

export default function RecordMatchForm({ players, currentUserId }: { players: Player[]; currentUserId: string }) {
  const supabase = createClient()
  const router = useRouter()

  const [team1p1, setTeam1p1] = useState('')
  const [team1p2, setTeam1p2] = useState('')
  const [team2p1, setTeam2p1] = useState('')
  const [team2p2, setTeam2p2] = useState('')
  const [sets, setSets] = useState<SetScore[]>([])
  const [editingSet, setEditingSet] = useState<number | null>(null)
  const [draftT1, setDraftT1] = useState(0)
  const [draftT2, setDraftT2] = useState(0)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const w1 = setsWon(sets, 1)
  const w2 = setsWon(sets, 2)
  const matchWinner = w1 === 2 ? 1 : w2 === 2 ? 2 : null
  const needsSet3 = sets.length === 2 && w1 === 1 && w2 === 1
  const setsToShow = matchWinner
    ? sets.length
    : Math.min(sets.length + 1, needsSet3 || sets.length === 3 ? 3 : 2)

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
    setSets(newSets.slice(0, setIndex + 1))
    setEditingSet(null)
  }

  const handleSubmit = async () => {
    if (!team1p1 || !team2p1) { toast.error('Please select at least one player per team'); return }
    if (!matchWinner) { toast.error('Match is not complete yet'); return }
    setSubmitting(true)
    const sb = supabase as any
    const scoreText = sets.map(s => `${s.t1}-${s.t2}`).join(' ')

    const { error } = await sb.from('matches').insert({
      team1_player1_id: team1p1 || null,
      team1_player2_id: team1p2 || null,
      team2_player1_id: team2p1 || null,
      team2_player2_id: team2p2 || null,
      team1_sets: w1,
      team2_sets: w2,
      winner_team: matchWinner,
      score: scoreText,
      notes: notes || null,
      recorded_by: currentUserId,
      played_at: new Date().toISOString(),
    })

    if (error) { toast.error('Could not record match'); setSubmitting(false); return }

    const winBonus = sets.length === 2 ? POINTS.win_bonus : 0
    const winners = matchWinner === 1 ? [team1p1, team1p2].filter(Boolean) : [team2p1, team2p2].filter(Boolean)
    const losers = matchWinner === 1 ? [team2p1, team2p2].filter(Boolean) : [team1p1, team1p2].filter(Boolean)

    for (const id of winners) {
      const { data: p } = await sb.from('profiles').select('wins, ranking_points').eq('id', id).single()
      await sb.from('profiles').update({ wins: (p?.wins ?? 0) + 1, ranking_points: (p?.ranking_points ?? 0) + POINTS.win + winBonus }).eq('id', id)
    }
    for (const id of losers) {
      const { data: p } = await sb.from('profiles').select('losses, ranking_points').eq('id', id).single()
      await sb.from('profiles').update({ losses: (p?.losses ?? 0) + 1, ranking_points: (p?.ranking_points ?? 0) + POINTS.loss }).eq('id', id)
    }

    toast.success('Match recorded! Leaderboard updated.')
    router.push('/players')
    router.refresh()
    setSubmitting(false)
  }

  const PlayerSelect = ({ value, onChange, exclude }: { value: string; onChange: (v: string) => void; exclude: string[] }) => (
    <select className="input text-sm" value={value} onChange={e => onChange(e.target.value)}>
      <option value="">— select —</option>
      {players.filter(p => !exclude.filter(Boolean).includes(p.id) || p.id === value).map(p => (
        <option key={p.id} value={p.id}>{p.nickname ?? p.full_name}</option>
      ))}
    </select>
  )

  const Stepper = ({ value, onChange, color }: { value: number; onChange: (n: number) => void; color: string }) => (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={() => onChange(Math.min(7, value + 1))}
        className="flex items-center justify-center rounded-lg font-bold transition-all"
        style={{ width: 44, height: 36, background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 18 }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.color = color }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-primary)' }}
      >+</button>
      <div style={{ fontSize: 56, fontWeight: 900, lineHeight: 1, color, minWidth: 70, textAlign: 'center' }}>{value}</div>
      <button
        onClick={() => onChange(Math.max(0, value - 1))}
        className="flex items-center justify-center rounded-lg font-bold transition-all"
        style={{ width: 44, height: 36, background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 18 }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.color = color }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-primary)' }}
      >–</button>
    </div>
  )

  const SetRow = ({ setIndex }: { setIndex: number }) => {
    const score = sets[setIndex]
    const isOpen = editingSet === setIndex
    const winner = score !== undefined ? setWinner(score) : null
    const draftValid = isValidSet(draftT1, draftT2)

    return (
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-primary)' }}>Set {setIndex + 1}</span>
          {score !== undefined && !isOpen && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-lg" style={{ background: winner === 1 ? 'var(--brand-primary-muted)' : 'var(--brand-accent-muted)', color: winner === 1 ? 'var(--brand-primary)' : 'var(--brand-accent)' }}>
              T{winner} ✓
            </span>
          )}
          <button onClick={() => openSet(setIndex)} className="ml-auto text-xs font-medium" style={{ color: 'var(--brand-primary)' }}>
            {isOpen ? 'cancel' : score !== undefined ? 'edit' : 'enter score'}
          </button>
        </div>

        {!isOpen ? (
          <div
            onClick={() => openSet(setIndex)}
            className="w-full flex items-center justify-center gap-6 py-3 rounded-xl cursor-pointer"
            style={{ background: 'var(--bg-raised)', border: `1.5px solid ${score !== undefined ? (winner === 1 ? 'var(--brand-primary)' : 'var(--brand-accent)') : 'var(--border)'}` }}
          >
            <span style={{ fontSize: 56, fontWeight: 900, lineHeight: 1, color: score !== undefined ? (winner === 1 ? 'var(--brand-primary)' : 'var(--text-primary)') : 'var(--text-subtle)' }}>{score?.t1 ?? '–'}</span>
            <span style={{ fontSize: 24, fontWeight: 200, color: 'var(--text-muted)' }}>–</span>
            <span style={{ fontSize: 56, fontWeight: 900, lineHeight: 1, color: score !== undefined ? (winner === 2 ? 'var(--brand-accent)' : 'var(--text-primary)') : 'var(--text-subtle)' }}>{score?.t2 ?? '–'}</span>
          </div>
        ) : (
          <div className="rounded-xl p-4" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-center gap-8 mb-3">
              <Stepper value={draftT1} onChange={setDraftT1} color="var(--brand-primary)" />
              <span style={{ fontSize: 28, fontWeight: 200, color: 'var(--text-muted)' }}>–</span>
              <Stepper value={draftT2} onChange={setDraftT2} color="var(--brand-accent)" />
            </div>
            <div className="text-center text-xs font-medium mb-3" style={{ color: draftValid ? 'var(--brand-primary)' : 'var(--text-muted)' }}>
              {draftT1 === draftT2 ? 'Scores can\u2019t be tied' : draftValid ? `Valid \u2014 Team ${draftT1 > draftT2 ? 1 : 2} wins this set` : 'Not a valid padel score yet'}
            </div>
            <button
              onClick={() => confirmSet(setIndex)}
              disabled={!draftValid}
              className="w-full py-2.5 rounded-lg text-sm font-bold transition-all"
              style={{
                background: draftValid ? 'var(--brand-primary)' : 'var(--bg-surface)',
                color: draftValid ? 'var(--brand-primary-on)' : 'var(--text-subtle)',
                border: draftValid ? 'none' : '1px solid var(--border)',
                cursor: draftValid ? 'pointer' : 'not-allowed',
              }}
            >
              Confirm set {setIndex + 1}
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--brand-primary)', boxShadow: 'var(--glow-primary)' }}>
          <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--brand-primary)' }}>Team 1</div>
          <div className="space-y-2">
            <div><label className="label">Player 1 *</label><PlayerSelect value={team1p1} onChange={setTeam1p1} exclude={[team1p2, team2p1, team2p2]} /></div>
            <div><label className="label">Player 2</label><PlayerSelect value={team1p2} onChange={setTeam1p2} exclude={[team1p1, team2p1, team2p2]} /></div>
          </div>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--brand-accent)', boxShadow: 'var(--glow-accent)' }}>
          <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--brand-accent)' }}>Team 2</div>
          <div className="space-y-2">
            <div><label className="label">Player 1 *</label><PlayerSelect value={team2p1} onChange={setTeam2p1} exclude={[team1p1, team1p2, team2p2]} /></div>
            <div><label className="label">Player 2</label><PlayerSelect value={team2p2} onChange={setTeam2p2} exclude={[team1p1, team1p2, team2p1]} /></div>
          </div>
        </div>
      </div>

      <div className="rounded-xl p-4 space-y-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-primary)' }}>Score</div>
        {Array.from({ length: setsToShow }).map((_, i) => <SetRow key={i} setIndex={i} />)}
        {matchWinner && (
          <div className="text-center text-sm font-semibold py-3 rounded-xl" style={{ background: matchWinner === 1 ? 'var(--brand-primary-muted)' : 'var(--brand-accent-muted)', color: matchWinner === 1 ? 'var(--brand-primary)' : 'var(--brand-accent)', border: `1px solid ${matchWinner === 1 ? 'var(--brand-primary)' : 'var(--brand-accent)'}` }}>
            🏆 Team {matchWinner} wins {sets.map(s => `${s.t1}–${s.t2}`).join(', ')}
          </div>
        )}
      </div>

      <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <label className="label">Notes (optional)</label>
        <textarea className="input text-sm" rows={2} placeholder="Any notes about the match..." value={notes} onChange={e => setNotes(e.target.value)} maxLength={200} />
      </div>

      <div className="rounded-xl p-3 text-xs font-semibold" style={{ background: 'var(--bg-raised)', color: 'var(--text-primary)' }}>
        Winners +{POINTS.win}{sets.length === 2 ? ` +${POINTS.win_bonus} bonus` : ''} pts · Losers +{POINTS.loss} pts
      </div>

      <button
        className="w-full py-3 rounded-xl text-base font-semibold transition-all"
        style={{ background: 'var(--brand-primary)', color: 'var(--brand-primary-on)', boxShadow: 'var(--glow-primary)' }}
        disabled={submitting || !team1p1 || !team2p1 || !matchWinner}
        onClick={handleSubmit}
      >
        {submitting ? 'Recording...' : 'Record match & update leaderboard'}
      </button>
    </div>
  )
}
