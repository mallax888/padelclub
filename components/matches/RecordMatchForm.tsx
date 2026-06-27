'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { playNumberSound } from '@/lib/sounds'

type Player = { id: string; full_name: string | null; nickname: string | null; ranking_points: number | null }

type SetScore = { t1: number | null; t2: number | null }

const POINTS = { win: 10, loss: 2, win_bonus: 5 }

function isValidSet(s: SetScore) {
  if (s.t1 === null || s.t2 === null) return false
  const hi = Math.max(s.t1, s.t2)
  const lo = Math.min(s.t1, s.t2)
  if (hi === 7 && lo === 6) return true
  if (hi === 6 && lo <= 5) return true
  return false
}

function setWinner(s: SetScore): 1 | 2 | null {
  if (!isValidSet(s)) return null
  return s.t1! > s.t2! ? 1 : 2
}

export default function RecordMatchForm({ players, currentUserId }: { players: Player[]; currentUserId: string }) {
  const supabase = createClient()
  const router = useRouter()

  const [team1p1, setTeam1p1] = useState('')
  const [team1p2, setTeam1p2] = useState('')
  const [team2p1, setTeam2p1] = useState('')
  const [team2p2, setTeam2p2] = useState('')
  const [sets, setSets] = useState<SetScore[]>([{ t1: null, t2: null }])
  const [activeSet, setActiveSet] = useState(0)
  const [activeTeam, setActiveTeam] = useState<1 | 2>(1)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const setWins = (team: 1 | 2) => sets.filter(s => setWinner(s) === team).length
  const matchWinner = setWins(1) === 2 ? 1 : setWins(2) === 2 ? 2 : null

  const handleNumber = (n: number) => {
    playNumberSound()
    const newSets = sets.map((s, i) => i === activeSet ? { ...s, [activeTeam === 1 ? 't1' : 't2']: n } : s)
    setSets(newSets)

    const current = newSets[activeSet]
    if (activeTeam === 1) {
      setActiveTeam(2)
    } else {
      if (isValidSet(current)) {
        const w1 = newSets.filter(s => setWinner(s) === 1).length
        const w2 = newSets.filter(s => setWinner(s) === 2).length
        if (w1 < 2 && w2 < 2 && newSets.length < 3) {
          setSets([...newSets, { t1: null, t2: null }])
          setActiveSet(newSets.length)
          setActiveTeam(1)
        }
      } else {
        setActiveTeam(1)
      }
    }
  }

  const handleSubmit = async () => {
    if (!team1p1 || !team2p1) { toast.error('Please select at least one player per team'); return }
    if (!matchWinner) { toast.error('Match is not complete yet'); return }
    setSubmitting(true)
    const sb = supabase as any

    const scoreText = sets.filter(s => isValidSet(s)).map(s => `${s.t1}-${s.t2}`).join(' ')

    const { error } = await sb.from('matches').insert({
      team1_player1_id: team1p1 || null,
      team1_player2_id: team1p2 || null,
      team2_player1_id: team2p1 || null,
      team2_player2_id: team2p2 || null,
      team1_sets: setWins(1),
      team2_sets: setWins(2),
      winner_team: matchWinner,
      score: scoreText,
      notes: notes || null,
      recorded_by: currentUserId,
      played_at: new Date().toISOString(),
    })

    if (error) { toast.error('Could not record match'); setSubmitting(false); return }

    const winBonus = sets.filter(s => isValidSet(s)).length === 2 ? POINTS.win_bonus : 0
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

  const validSets = sets.filter(s => isValidSet(s))

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

      {/* Score display */}
      <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>Score</div>

        {/* Set scores */}
        <div className="space-y-2 mb-4">
          {sets.map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="text-xs w-10 shrink-0" style={{ color: 'var(--text-subtle)' }}>Set {i + 1}</div>
              <div className="flex items-center gap-2 flex-1">
                <button
                  onClick={() => { setActiveSet(i); setActiveTeam(1) }}
                  className="flex-1 py-2 rounded-lg text-lg font-bold text-center transition-all"
                  style={{
                    background: activeSet === i && activeTeam === 1 ? 'var(--brand-primary)' : 'var(--bg-raised)',
                    color: activeSet === i && activeTeam === 1 ? 'var(--brand-primary-on)' : s.t1 !== null ? 'var(--text-primary)' : 'var(--text-subtle)',
                    border: `1px solid ${activeSet === i && activeTeam === 1 ? 'var(--brand-primary)' : 'var(--border)'}`,
                  }}>
                  {s.t1 !== null ? s.t1 : '—'}
                </button>
                <div className="text-sm font-bold" style={{ color: 'var(--text-subtle)' }}>–</div>
                <button
                  onClick={() => { setActiveSet(i); setActiveTeam(2) }}
                  className="flex-1 py-2 rounded-lg text-lg font-bold text-center transition-all"
                  style={{
                    background: activeSet === i && activeTeam === 2 ? 'var(--brand-accent)' : 'var(--bg-raised)',
                    color: activeSet === i && activeTeam === 2 ? 'var(--brand-accent-on)' : s.t2 !== null ? 'var(--text-primary)' : 'var(--text-subtle)',
                    border: `1px solid ${activeSet === i && activeTeam === 2 ? 'var(--brand-accent)' : 'var(--border)'}`,
                  }}>
                  {s.t2 !== null ? s.t2 : '—'}
                </button>
                {isValidSet(s) && (
                  <div className="text-xs shrink-0 w-12 text-center font-medium"
                    style={{ color: setWinner(s) === 1 ? 'var(--brand-primary)' : 'var(--brand-accent)' }}>
                    T{setWinner(s)} ✓
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Number pad */}
        <div className="grid grid-cols-4 gap-2">
          {[0,1,2,3,4,5,6,7].map(n => (
            <button key={n} onClick={() => handleNumber(n)}
              className="py-3 rounded-xl text-lg font-bold transition-all"
              style={{
                background: 'var(--bg-raised)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = activeTeam === 1 ? 'var(--brand-primary)' : 'var(--brand-accent)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              {n}
            </button>
          ))}
        </div>

        <div className="mt-2 text-xs text-center" style={{ color: 'var(--text-subtle)' }}>
          Entering score for <span style={{ color: activeTeam === 1 ? 'var(--brand-primary)' : 'var(--brand-accent)', fontWeight: 600 }}>Team {activeTeam}</span> — Set {activeSet + 1}
        </div>

        {/* Match result */}
        {matchWinner && (
          <div className="mt-3 text-center text-sm font-semibold py-2 rounded-lg"
            style={{
              background: matchWinner === 1 ? 'var(--brand-primary-muted)' : 'var(--brand-accent-muted)',
              color: matchWinner === 1 ? 'var(--brand-primary)' : 'var(--brand-accent)',
            }}>
            🏆 Team {matchWinner} wins {validSets.map(s => `${s.t1}-${s.t2}`).join(', ')}
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
        Winners +{POINTS.win}{validSets.length === 2 ? ` +${POINTS.win_bonus} bonus` : ''} pts · Losers +{POINTS.loss} pts
      </div>

      <button className="w-full py-3 rounded-xl text-base font-semibold transition-all"
        style={{ background: 'var(--brand-primary)', color: 'var(--brand-primary-on)', boxShadow: 'var(--glow-primary)' }}
        disabled={submitting || !team1p1 || !team2p1 || !matchWinner}
        onClick={handleSubmit}>
        {submitting ? 'Recording...' : 'Record match & update leaderboard'}
      </button>
    </div>
  )
}
