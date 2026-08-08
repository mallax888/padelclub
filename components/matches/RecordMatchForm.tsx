'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { getInitials } from '@/lib/utils'

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

  const playerLabel = (id: string) => {
    const p = players.find(pl => pl.id === id)
    return p ? (p.nickname ?? p.full_name ?? 'Player') : null
  }
  const team1Name = playerLabel(team1p1) ?? 'Team 1'
  const team1Sub = playerLabel(team1p2)
  const team2Name = playerLabel(team2p1) ?? 'Team 2'
  const team2Sub = playerLabel(team2p2)

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

    const res = await fetch('/api/record-match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team1p1, team1p2, team2p1, team2p2, sets, matchWinner, notes, idempotencyKey }),
    })
    const data = await res.json()

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

  const PlayerSelect = ({ value, onChange, exclude }: { value: string; onChange: (v: string) => void; exclude: string[] }) => (
    <select className="input text-sm" value={value} onChange={e => onChange(e.target.value)}>
      <option value="">— select —</option>
      {players.filter(p => !exclude.filter(Boolean).includes(p.id) || p.id === value).map(p => (
        <option key={p.id} value={p.id}>{p.nickname ?? p.full_name}</option>
      ))}
    </select>
  )

  const ScoreStepper = ({ value, onChange, color }: { value: number; onChange: (n: number) => void; color: string }) => {
    const dec = () => { if (value > 0) onChange(value - 1) }
    const inc = () => { if (value < 7) onChange(value + 1) }
    return (
      <div className="flex items-center justify-center gap-2" style={{ flex: 1, height: 84, borderRadius: 12, background: 'var(--bg-surface)', border: `1.5px solid ${color}` }}>
        <button
          type="button" onClick={dec} disabled={value <= 0}
          className="flex items-center justify-center rounded-lg"
          style={{ width: 36, height: 36, fontSize: 20, fontWeight: 700, color, border: `1px solid ${color}`, background: 'var(--bg-raised)', opacity: value <= 0 ? 0.35 : 1, cursor: value <= 0 ? 'not-allowed' : 'pointer' }}
        >
          −
        </button>
        <div style={{ width: 52, textAlign: 'center', fontSize: 40, fontWeight: 900, fontVariantNumeric: 'tabular-nums', color }}>{value}</div>
        <button
          type="button" onClick={inc} disabled={value >= 7}
          className="flex items-center justify-center rounded-lg"
          style={{ width: 36, height: 36, fontSize: 20, fontWeight: 700, color, border: `1px solid ${color}`, background: 'var(--bg-raised)', opacity: value >= 7 ? 0.35 : 1, cursor: value >= 7 ? 'not-allowed' : 'pointer' }}
        >
          +
        </button>
      </div>
    )
  }

  const draftValid = isValidSet(draftT1, draftT2)

  const Avatar = ({ label, active, color, colorOn }: { label: string; active: boolean; color: string; colorOn: string }) => (
    <div
      className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-extrabold mx-auto mb-2"
      style={{
        background: active ? color : 'var(--bg-raised)',
        color: active ? colorOn : 'var(--text-muted)',
        border: `2px solid ${active ? color : 'var(--border)'}`,
      }}
    >
      {getInitials(label)}
    </div>
  )

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="rounded-2xl p-5" style={{ background: 'linear-gradient(180deg, var(--bg-surface), var(--bg-raised))', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 min-w-0 text-center">
            <Avatar label={team1Name} active={!!team1p1} color="var(--brand-primary)" colorOn="var(--brand-primary-on)" />
            <div className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{team1Name}</div>
            {team1Sub && <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>&amp; {team1Sub}</div>}
          </div>
          <div className="text-xs font-black shrink-0" style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>VS</div>
          <div className="flex-1 min-w-0 text-center">
            <Avatar label={team2Name} active={!!team2p1} color="var(--brand-accent)" colorOn="#fff" />
            <div className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{team2Name}</div>
            {team2Sub && <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>&amp; {team2Sub}</div>}
          </div>
        </div>

        {sets.some((s, i) => s !== undefined && i !== activeSetIndex) && (
          <div className="flex flex-wrap justify-center gap-1.5 mb-4">
            {sets.map((score, i) => i === activeSetIndex ? null : (
              <button
                key={i}
                onClick={() => openSet(i)}
                className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                style={{ background: setWinner(score) === 1 ? 'var(--brand-primary-muted)' : 'var(--brand-accent-muted)', color: setWinner(score) === 1 ? 'var(--brand-primary)' : 'var(--brand-accent)' }}
              >
                Set {i + 1}: {score.t1}–{score.t2}
              </button>
            ))}
          </div>
        )}

        {activeSetIndex !== null && (
          <div className="pt-4" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="text-center text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>Set {activeSetIndex + 1}</div>
            <div className="flex items-center justify-center gap-6 mb-3">
              <ScoreStepper value={draftT1} onChange={setDraftT1} color="var(--brand-primary)" />
              <span style={{ fontSize: 22, fontWeight: 200, color: 'var(--text-muted)' }}>–</span>
              <ScoreStepper value={draftT2} onChange={setDraftT2} color="var(--brand-accent)" />
            </div>
            <div className="text-center text-xs font-medium mb-3" style={{ color: draftValid ? 'var(--brand-primary)' : 'var(--text-muted)' }}>
              {draftT1 === draftT2 ? 'Scores can\u2019t be tied' : draftValid ? `Valid \u2014 Team ${draftT1 > draftT2 ? 1 : 2} wins this set` : 'Not a valid padel score yet'}
            </div>
            <button
              onClick={() => confirmSet(activeSetIndex)}
              disabled={!draftValid}
              className="w-full py-2.5 rounded-lg text-sm font-bold transition-all"
              style={{
                background: draftValid ? 'var(--brand-primary)' : 'var(--bg-surface)',
                color: draftValid ? 'var(--brand-primary-on)' : 'var(--text-subtle)',
                border: draftValid ? 'none' : '1px solid var(--border)',
                cursor: draftValid ? 'pointer' : 'not-allowed',
              }}
            >
              Confirm set {activeSetIndex + 1}
            </button>
          </div>
        )}

        {matchWinner && (
          <div className="text-center text-sm font-semibold py-3 mt-4 rounded-xl" style={{ background: matchWinner === 1 ? 'var(--brand-primary-muted)' : 'var(--brand-accent-muted)', color: matchWinner === 1 ? 'var(--brand-primary)' : 'var(--brand-accent)', border: `1px solid ${matchWinner === 1 ? 'var(--brand-primary)' : 'var(--brand-accent)'}` }}>
            🏆 Team {matchWinner} wins {sets.map(s => `${s.t1}–${s.t2}`).join(', ')}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div className="text-xs font-extrabold uppercase tracking-wide mb-3" style={{ color: 'var(--brand-primary)' }}>Team 1</div>
          <div className="space-y-2">
            <div><label className="label">Player 1 *</label><PlayerSelect value={team1p1} onChange={setTeam1p1} exclude={[team1p2, team2p1, team2p2]} /></div>
            <div><label className="label">Player 2</label><PlayerSelect value={team1p2} onChange={setTeam1p2} exclude={[team1p1, team2p1, team2p2]} /></div>
          </div>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div className="text-xs font-extrabold uppercase tracking-wide mb-3" style={{ color: 'var(--brand-accent)' }}>Team 2</div>
          <div className="space-y-2">
            <div><label className="label">Player 1 *</label><PlayerSelect value={team2p1} onChange={setTeam2p1} exclude={[team1p1, team1p2, team2p2]} /></div>
            <div><label className="label">Player 2</label><PlayerSelect value={team2p2} onChange={setTeam2p2} exclude={[team1p1, team1p2, team2p1]} /></div>
          </div>
        </div>
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
