'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

type Player = {
  id: string
  full_name: string | null
  nickname: string | null
  skill_level: string | null
  ranking_points: number | null
}

type Court = {
  id: string
  name: string
  type: string
}

const POINTS = { win: 10, loss: 2, win_bonus: 5 }

export default function RecordMatchForm({ players, courts, currentUserId }: { players: Player[]; courts: Court[]; currentUserId: string }) {
  const supabase = createClient()
  const router = useRouter()
  const [team1p1, setTeam1p1] = useState('')
  const [team1p2, setTeam1p2] = useState('')
  const [team2p1, setTeam2p1] = useState('')
  const [team2p2, setTeam2p2] = useState('')
  const [team1sets, setTeam1sets] = useState(0)
  const [team2sets, setTeam2sets] = useState(0)
  const [courtId, setCourtId] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const winnerTeam = team1sets > team2sets ? 1 : team2sets > team1sets ? 2 : 0

  const handleSubmit = async () => {
    if (!team1p1 || !team2p1) { toast.error('Please select at least one player per team'); return }
    if (team1sets === team2sets) { toast.error('There must be a winner'); return }
    setSubmitting(true)
    const sb = supabase as any
    const { error } = await sb.from('matches').insert({
      team1_player1_id: team1p1 || null,
      team1_player2_id: team1p2 || null,
      team2_player1_id: team2p1 || null,
      team2_player2_id: team2p2 || null,
      team1_sets: team1sets,
      team2_sets: team2sets,
      winner_team: winnerTeam,
      court_id: courtId || null,
      notes: notes || null,
      recorded_by: currentUserId,
      played_at: new Date().toISOString(),
    })
    if (error) { toast.error('Could not record match'); setSubmitting(false); return }
    const winBonus = Math.abs(team1sets - team2sets) === 2 ? POINTS.win_bonus : 0
    const winners = winnerTeam === 1 ? [team1p1, team1p2].filter(Boolean) : [team2p1, team2p2].filter(Boolean)
    const losers = winnerTeam === 1 ? [team2p1, team2p2].filter(Boolean) : [team1p1, team1p2].filter(Boolean)
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

      <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>Sets won</div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label" style={{ color: 'var(--brand-primary)' }}>Team 1</label>
            <div className="flex gap-2">
              {[0,1,2].map(n => (
                <button key={n} onClick={() => setTeam1sets(n)} className="flex-1 py-2 rounded-lg text-sm font-bold transition-all"
                  style={{ background: team1sets === n ? 'var(--brand-primary)' : 'var(--bg-raised)', color: team1sets === n ? 'var(--brand-primary-on)' : 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label" style={{ color: 'var(--brand-accent)' }}>Team 2</label>
            <div className="flex gap-2">
              {[0,1,2].map(n => (
                <button key={n} onClick={() => setTeam2sets(n)} className="flex-1 py-2 rounded-lg text-sm font-bold transition-all"
                  style={{ background: team2sets === n ? 'var(--brand-accent)' : 'var(--bg-raised)', color: team2sets === n ? 'var(--brand-accent-on)' : 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
        {winnerTeam > 0 && (
          <div className="mt-3 text-center text-sm font-medium" style={{ color: winnerTeam === 1 ? 'var(--brand-primary)' : 'var(--brand-accent)' }}>
            Team {winnerTeam} wins {winnerTeam === 1 ? team1sets : team2sets}–{winnerTeam === 1 ? team2sets : team1sets}
            {Math.abs(team1sets - team2sets) === 2 && ' (+bonus pts!)'}
          </div>
        )}
      </div>

      <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <label className="label">Court (optional)</label>
        <select className="input text-sm" value={courtId} onChange={e => setCourtId(e.target.value)}>
          <option value="">— select court —</option>
          {courts.map(c => <option key={c.id} value={c.id}>{c.name} — {c.type}</option>)}
        </select>
      </div>

      <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <label className="label">Notes (optional)</label>
        <textarea className="input text-sm" rows={2} placeholder="Any notes about the match..." value={notes} onChange={e => setNotes(e.target.value)} maxLength={200} />
      </div>

      <div className="rounded-xl p-3 text-xs" style={{ background: 'var(--bg-raised)', color: 'var(--text-muted)' }}>
        Winners get +{POINTS.win}{Math.abs(team1sets - team2sets) === 2 ? ` +${POINTS.win_bonus} bonus` : ''} pts · Losers get +{POINTS.loss} pts for playing
      </div>

      <button className="w-full py-3 rounded-xl text-base font-semibold transition-all"
        style={{ background: 'var(--brand-primary)', color: 'var(--brand-primary-on)', boxShadow: 'var(--glow-primary)' }}
        disabled={submitting || !team1p1 || !team2p1 || team1sets === team2sets}
        onClick={handleSubmit}>
        {submitting ? 'Recording...' : 'Record match & update leaderboard'}
      </button>
    </div>
  )
}
