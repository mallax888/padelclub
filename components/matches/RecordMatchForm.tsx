'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

type Player = { id: string; full_name: string | null; nickname: string | null; ranking_points: number | null }
type SetScore = { t1: number; t2: number }

const POINTS = { win: 10, loss: 2, win_bonus: 5 }

// Each entry: [team1_score, team2_score] where t1 > t2 (team 1 wins)
// Popover shows both orientations in one grid
const SCORES: [number, number][] = [
  [6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [7, 5], [7, 6],
]

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
  const [openSet, setOpenSet] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  const w1 = setsWon(sets, 1)
  const w2 = setsWon(sets, 2)
  const matchWinner = w1 === 2 ? 1 : w2 === 2 ? 2 : null
  const needsSet3 = sets.length === 2 && w1 === 1 && w2 === 1

  // Close popover on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpenSet(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handlePick = (t1: number, t2: number, setIndex: number) => {
    const newSets = sets.slice(0, setIndex)
    newSets.push({ t1, t2 })
    setSets(newSets)
    setOpenSet(null)
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

  const SetRow = ({ setIndex }: { setIndex: number }) => {
    const score = sets[setIndex]
    const isOpen = openSet === setIndex
    const canOpen = setIndex === sets.length || (score !== undefined)

    return (
      <div className="relative" ref={isOpen ? popoverRef : undefined}>
        <div className="flex items-center gap-3">
          <span className="text-xs w-10 shrink-0" style={{ color: 'var(--text-subtle)' }}>Set {setIndex + 1}</span>

          {/* Score bubbles - click to open popover */}
          <button
            onClick={() => canOpen ? setOpenSet(isOpen ? null : setIndex) : undefined}
            className="w-11 h-11 rounded-xl flex items-center justify-center text-xl font-bold transition-all"
            style={{
              background: score ? 'var(--brand-primary-muted)' : isOpen ? 'var(--brand-primary-muted)' : 'var(--bg-raised)',
              border: `1.5px solid ${score || isOpen ? 'var(--brand-primary)' : 'var(--border)'}`,
              color: score || isOpen ? 'var(--brand-primary)' : 'var(--text-subtle)',
              boxShadow: isOpen ? '0 0 0 2px var(--brand-primary)' : 'none',
            }}
          >
            {score !== undefined ? score.t1 : '?'}
          </button>

          <span className="text-sm font-light" style={{ color: 'var(--text-subtle)' }}>–</span>

          <button
            onClick={() => canOpen ? setOpenSet(isOpen ? null : setIndex) : undefined}
            className="w-11 h-11 rounded-xl flex items-center justify-center text-xl font-bold transition-all"
            style={{
              background: score ? 'var(--brand-accent-muted)' : isOpen ? 'var(--brand-accent-muted)' : 'var(--bg-raised)',
              border: `1.5px solid ${score || isOpen ? 'var(--brand-accent)' : 'var(--border)'}`,
              color: score || isOpen ? 'var(--brand-accent)' : 'var(--text-subtle)',
              boxShadow: isOpen ? '0 0 0 2px var(--brand-accent)' : 'none',
            }}
          >
            {score !== undefined ? score.t2 : '?'}
          </button>

          {score && (
            <span
              className="text-xs font-semibold px-2 py-1 rounded-lg ml-1"
              style={{
                background: setWinner(score) === 1 ? 'var(--brand-primary-muted)' : 'var(--brand-accent-muted)',
                color: setWinner(score) === 1 ? 'var(--brand-primary)' : 'var(--brand-accent)',
              }}
            >
              T{setWinner(score)} ✓
            </span>
          )}

          {score && setIndex === sets.length - 1 && (
            <button
              onClick={() => { setSets(prev => prev.slice(0, setIndex)); setOpenSet(null) }}
              className="text-xs px-2 py-1 rounded-lg ml-auto"
              style={{ color: 'var(--text-subtle)', background: 'var(--bg-raised)', border: '1px solid var(--border)' }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Popover */}
        {isOpen && (
          <div
            className="absolute left-10 z-50 mt-2 rounded-2xl p-3"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              minWidth: '260px',
            }}
          >
            {/* Caret */}
            <div
              className="absolute -top-2 left-8"
              style={{
                width: 0, height: 0,
                borderLeft: '7px solid transparent',
                borderRight: '7px solid transparent',
                borderBottom: '8px solid var(--border)',
              }}
            />
            <div
              className="absolute -top-1.5 left-8"
              style={{
                width: 0, height: 0,
                borderLeft: '7px solid transparent',
                borderRight: '7px solid transparent',
                borderBottom: '8px solid var(--bg-surface)',
              }}
            />

            {/* Column headers */}
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="text-center text-xs font-semibold py-1 rounded-lg" style={{ color: 'var(--brand-primary)', background: 'var(--brand-primary-muted)' }}>
                Team 1 wins
              </div>
              <div className="text-center text-xs font-semibold py-1 rounded-lg" style={{ color: 'var(--brand-accent)', background: 'var(--brand-accent-muted)' }}>
                Team 2 wins
              </div>
            </div>

            {/* Score rows — one row per preset, T1 wins left, T2 wins right */}
            <div className="flex flex-col gap-1.5">
              {SCORES.map(([a, b]) => (
                <div key={`${a}-${b}`} className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handlePick(a, b, setIndex)}
                    className="py-2 rounded-xl text-sm font-bold transition-all"
                    style={{ background: 'var(--bg-raised)', border: '1px solid var(--brand-primary)', color: 'var(--brand-primary)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--brand-primary-muted)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-raised)')}
                  >
                    {a} – {b}
                  </button>
                  <button
                    onClick={() => handlePick(b, a, setIndex)}
                    className="py-2 rounded-xl text-sm font-bold transition-all"
                    style={{ background: 'var(--bg-raised)', border: '1px solid var(--brand-accent)', color: 'var(--brand-accent)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--brand-accent-muted)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-raised)')}
                  >
                    {b} – {a}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  const setsToShow = Math.min(
    sets.length + (matchWinner ? 0 : 1),
    needsSet3 || sets.length === 3 ? 3 : 2
  )

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
      <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Score</div>
        <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>Tap a set row to enter the score</p>

        {Array.from({ length: setsToShow }).map((_, i) => (
          <SetRow key={i} setIndex={i} />
        ))}

        {matchWinner && (
          <div
            className="text-center text-sm font-semibold py-3 rounded-xl mt-2"
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
