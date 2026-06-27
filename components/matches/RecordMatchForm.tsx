'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

type Player = { id: string; full_name: string | null; nickname: string | null; ranking_points: number | null }

type SetScore = { t1: number; t2: number }

const POINTS = { win: 10, loss: 2, win_bonus: 5 }

const SET_PRESETS: [number, number][] = [
  [6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [7, 5], [7, 6],
]

function setWinner(s: SetScore): 1 | 2 {
  return s.t1 > s.t2 ? 1 : 2
}

function setsWon(sets: SetScore[], team: 1 | 2) {
  return sets.filter(s => setWinner(s) === team).length
}

export default function RecordMatchForm({ players, currentUserId }: { players: Player[]; currentUserId: string }) {
  const supabase = createClient()
  const router = useRouter()

  const [team1p1, setTeam1p1] = useState('')
  const [team1p2, setTeam1p2] = useState('')
  const [team2p1, setTeam2p1] = useState('')
  const [team2p2, setTeam2p2] = useState('')
  const [sets, setSets] = useState<SetScore[]>([])
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const w1 = setsWon(sets, 1)
  const w2 = setsWon(sets, 2)
  const matchWinner = w1 === 2 ? 1 : w2 === 2 ? 2 : null
  const needsSet3 = sets.length === 2 && w1 === 1 && w2 === 1
  const showSet3 = needsSet3 && !matchWinner
  const currentSetIndex = sets.length
  const awaitingSet = !matchWinner && currentSetIndex < 3 && (currentSetIndex < 2 || showSet3)

  const handlePreset = (t1: number, t2: number, forSet: number) => {
    if (forSet < sets.length) {
      const newSets = sets.slice(0, forSet)
      setSets([...newSets, { t1, t2 }])
      return
    }
    setSets(prev => [...prev, { t1, t2 }])
  }

  const handleRemoveSet = (index: number) => {
    setSets(prev => prev.slice(0, index))
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

  const SetChips = ({ setIndex }: { setIndex: number }) => {
    const completedScore = sets[setIndex]
    const isActive = setIndex === currentSetIndex && awaitingSet

    if (completedScore !== undefined) {
      const winner = setWinner(completedScore)
      return (
        <div className="flex items-center gap-3">
          <span className="text-xs w-10 shrink-0" style={{ color: 'var(--text-subtle)' }}>Set {setIndex + 1}</span>
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-bold"
              style={{
                background: winner === 1 ? 'var(--brand-primary-muted)' : 'var(--brand-accent-muted)',
                border: `1px solid ${winner === 1 ? 'var(--brand-primary)' : 'var(--brand-accent)'}`,
                color: winner === 1 ? 'var(--brand-primary)' : 'var(--brand-accent)',
              }}
            >
              <span>{completedScore.t1}</span>
              <span style={{ opacity: 0.5 }}>–</span>
              <span>{completedScore.t2}</span>
              <span className="ml-1 text-xs">T{winner} ✓</span>
            </div>
            {!matchWinner && setIndex === sets.length - 1 && (
              <button
                onClick={() => handleRemoveSet(setIndex)}
                className="text-xs px-2 py-1 rounded-lg"
                style={{ color: 'var(--text-muted)', background: 'var(--bg-raised)', border: '1px solid var(--border)' }}
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )
    }

    if (!isActive) return null

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs w-10 shrink-0" style={{ color: 'var(--text-subtle)' }}>Set {setIndex + 1}</span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Select score — Team 1 left · Team 2 right</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {SET_PRESETS.map(([a, b]) => (
            <button
              key={`t1-${a}-${b}`}
              onClick={() => handlePreset(a, b, setIndex)}
              className="py-2 px-1 rounded-xl text-sm font-bold transition-all"
              style={{ background: 'var(--bg-raised)', border: '1px solid var(--brand-primary)', color: 'var(--brand-primary)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--brand-primary-muted)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-raised)')}
            >
              {a}–{b}
            </button>
          ))}
          {SET_PRESETS.map(([a, b]) => (
            <button
              key={`t2-${a}-${b}`}
              onClick={() => handlePreset(b, a, setIndex)}
              className="py-2 px-1 rounded-xl text-sm font-bold transition-all"
              style={{ background: 'var(--bg-raised)', border: '1px solid var(--brand-accent)', color: 'var(--brand-accent)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--brand-accent-muted)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-raised)')}
            >
              {b}–{a}
            </button>
          ))}
        </div>
        <div className="flex gap-4 text-xs pt-1" style={{ color: 'var(--text-subtle)' }}>
          <span><span style={{ color: 'var(--brand-primary)' }}>■</span> Team 1 wins set</span>
          <span><span style={{ color: 'var(--brand-accent)' }}>■</span> Team 2 wins set</span>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">

      {/* Teams */}
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

      {/* Score */}
      <div className="rounded-xl p-4 space-y-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Score</div>
        <SetChips setIndex={0} />
        {sets.length >= 1 && <SetChips setIndex={1} />}
        {sets.length >= 2 && (showSet3 || sets.length === 3) && <SetChips setIndex={2} />}
        {matchWinner && (
          <div
            className="text-center text-sm font-semibold py-3 rounded-xl"
            style={{
              background: matchWinner === 1 ? 'var(--brand-primary-muted)' : 'var(--brand-accent-muted)',
              color: matchWinner === 1 ? 'var(--brand-primary)' : 'var(--brand-accent)',
              border: `1px solid ${matchWinner === 1 ? 'var(--brand-primary)' : 'var(--brand-accent)'}`,
            }}
          >
            🏆 Team {matchWinner} wins {sets.map(s => `${s.t1}–${s.t2}`).join(', ')}
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <label className="label">Notes (optional)</label>
        <textarea className="input text-sm" rows={2} placeholder="Any notes about the match..."
          value={notes} onChange={e => setNotes(e.target.value)} maxLength={200} />
      </div>

      <div className="rounded-xl p-3 text-xs" style={{ background: 'var(--bg-raised)', color: 'var(--text-muted)' }}>
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
