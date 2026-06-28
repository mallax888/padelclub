'use client'

import { useState, useEffect, useRef } from 'react'
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
  const [activeSet, setActiveSet] = useState<number | null>(null)
  const [activeTeam, setActiveTeam] = useState<1 | 2>(1)
  const [pendingT1, setPendingT1] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  const w1 = setsWon(sets, 1)
  const w2 = setsWon(sets, 2)
  const matchWinner = w1 === 2 ? 1 : w2 === 2 ? 2 : null
  const needsSet3 = sets.length === 2 && w1 === 1 && w2 === 1
  const setsToShow = matchWinner
    ? sets.length
    : Math.min(sets.length + 1, needsSet3 || sets.length === 3 ? 3 : 2)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setActiveSet(null)
        setActiveTeam(1)
        setPendingT1(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const openSet = (setIndex: number) => {
    if (activeSet === setIndex) {
      setActiveSet(null)
      setActiveTeam(1)
      setPendingT1(null)
    } else {
      setActiveSet(setIndex)
      setActiveTeam(1)
      setPendingT1(null)
    }
  }

  const handleNumber = (n: number) => {
    if (activeSet === null) return
    if (activeTeam === 1) {
      setPendingT1(n)
      setActiveTeam(2)
    } else {
      const t1 = pendingT1 ?? 0
      const t2 = n
      if (!isValidSet(t1, t2)) {
        toast.error(`${t1}–${t2} is not a valid padel score`)
        setActiveTeam(1)
        setPendingT1(null)
        return
      }
      const newSets = [...sets]
      newSets[activeSet] = { t1, t2 }
      setSets(newSets.slice(0, activeSet + 1))
      setActiveSet(null)
      setActiveTeam(1)
      setPendingT1(null)
    }
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
    const isOpen = activeSet === setIndex
    const winner = score !== undefined ? setWinner(score) : null

    const bubbleBase: React.CSSProperties = {
      flex: 1,
      height: 120,
      borderRadius: 14,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 96,
      fontWeight: 900,
      cursor: 'pointer',
      transition: 'all 0.12s',
      lineHeight: 1,
      letterSpacing: '-4px',
    }

    const neutralBubble: React.CSSProperties = { ...bubbleBase, background: 'var(--bg-raised)', border: '1.5px solid var(--border)', color: 'var(--text-subtle)' }
    const activeBubble: React.CSSProperties = { ...bubbleBase, background: 'var(--bg-raised)', border: '1.5px solid rgba(255,255,255,0.4)', color: 'var(--text-primary)', boxShadow: '0 0 0 2px rgba(255,255,255,0.15)' }
    const winnerT1: React.CSSProperties = { ...bubbleBase, background: 'var(--brand-primary-muted)', border: '1.5px solid var(--brand-primary)', color: 'var(--brand-primary)' }
    const winnerT2: React.CSSProperties = { ...bubbleBase, background: 'var(--brand-accent-muted)', border: '1.5px solid var(--brand-accent)', color: 'var(--brand-accent)' }
    // Loser — same size, dark grey number, no colour
    const loserBubble: React.CSSProperties = { ...bubbleBase, background: 'var(--bg-raised)', border: '1.5px solid var(--border)', color: 'rgba(255,255,255,0.2)' }

    const t1Style = score !== undefined && !isOpen
      ? (winner === 1 ? winnerT1 : loserBubble)
      : isOpen && activeTeam === 1 ? activeBubble
      : isOpen && activeTeam === 2 ? { ...winnerT1, opacity: 0.7 }
      : neutralBubble

    const t2Style = score !== undefined && !isOpen
      ? (winner === 2 ? winnerT2 : loserBubble)
      : isOpen && activeTeam === 2 ? activeBubble
      : neutralBubble

    return (
      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-subtle)' }}>Set {setIndex + 1}</span>
          {score !== undefined && !isOpen && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-lg" style={{ background: winner === 1 ? 'var(--brand-primary-muted)' : 'var(--brand-accent-muted)', color: winner === 1 ? 'var(--brand-primary)' : 'var(--brand-accent)' }}>
              T{winner} ✓
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div style={t1Style} onClick={() => openSet(setIndex)}>
            {isOpen && activeTeam === 1 ? '?' : isOpen && activeTeam === 2 ? pendingT1 : score !== undefined ? score.t1 : '?'}
          </div>
          <span style={{ color: 'var(--text-subtle)', fontSize: 40, fontWeight: 200, flexShrink: 0 }}>–</span>
          <div style={t2Style} onClick={() => openSet(setIndex)}>
            {isOpen ? '?' : score !== undefined ? score.t2 : '?'}
          </div>
        </div>

        {isOpen && (
          <div ref={popoverRef} className="absolute z-50 mt-2" style={{ left: 0, right: 0, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
            <div className="text-center text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
              Team {activeTeam} · Set {setIndex + 1}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {[0, 1, 2, 3, 4, 5, 6, 7].map(n => (
                <button
                  key={n}
                  onClick={() => handleNumber(n)}
                  className="flex items-center justify-center rounded-xl font-bold transition-all"
                  style={{ height: 60, fontSize: 26, background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-raised)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                >
                  {n}
                </button>
              ))}
            </div>
            {activeTeam === 2 && (
              <button
                onClick={() => { setActiveTeam(1); setPendingT1(null) }}
                className="w-full mt-3 text-xs py-2 rounded-lg"
                style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-subtle)' }}
              >
                ← back
              </button>
            )}
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
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Score</div>
          <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>Tap to enter or edit</div>
        </div>
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
