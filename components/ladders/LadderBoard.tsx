'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import toast from 'react-hot-toast'
import { getInitials } from '@/lib/utils'
import type { Ladder, LadderChallenge } from '@/types/database'

type EntryWithProfile = {
  id: string
  ladder_id: string
  player_id: string
  position: number
  wins: number
  losses: number
  profiles: { full_name: string | null; nickname: string | null } | null
}

function playerName(p: { full_name: string | null; nickname: string | null } | null) {
  return p?.nickname || p?.full_name || 'Player'
}

function ReportForm({ challenge, myEntryId, opponentEntryId, opponentName, onDone }: {
  challenge: LadderChallenge
  myEntryId: string
  opponentEntryId: string
  opponentName: string
  onDone: () => void
}) {
  const supabase = createClient()
  const [winner, setWinner] = useState<'me' | 'them' | null>(null)
  const [score, setScore] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!winner) { toast.error('Pick who won'); return }
    setSaving(true)
    const winnerEntryId = winner === 'me' ? myEntryId : opponentEntryId
    const { error } = await supabase.rpc('report_ladder_challenge', {
      p_challenge_id: challenge.id,
      p_winner_entry_id: winnerEntryId,
      p_score: score.trim() || null,
    })
    setSaving(false)
    if (error) {
      toast.error(error.message || 'Could not report result')
      return
    }
    toast.success('Result recorded!')
    onDone()
  }

  return (
    <div className="mt-2.5 pt-2.5" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="flex gap-1.5">
        <button type="button" onClick={() => setWinner('me')} className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{ background: winner === 'me' ? 'var(--brand-primary)' : 'var(--bg-raised)', color: winner === 'me' ? 'var(--brand-primary-on)' : 'var(--text-muted)' }}>
          I won
        </button>
        <button type="button" onClick={() => setWinner('them')} className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{ background: winner === 'them' ? 'var(--brand-primary)' : 'var(--bg-raised)', color: winner === 'them' ? 'var(--brand-primary-on)' : 'var(--text-muted)' }}>
          {opponentName} won
        </button>
      </div>
      <input type="text" placeholder="Score (optional) — e.g. 6-3 6-4" value={score} onChange={e => setScore(e.target.value)}
        className="input text-xs mt-1.5" />
      <button type="button" onClick={submit} disabled={saving || !winner} className="btn btn-primary btn-sm w-full justify-center mt-1.5">
        {saving ? 'Saving…' : 'Submit result'}
      </button>
    </div>
  )
}

export default function LadderBoard({ ladder, entries, challenges, isStaff, currentUserId }: {
  ladder: Ladder
  entries: EntryWithProfile[]
  challenges: LadderChallenge[]
  isStaff: boolean
  currentUserId: string
}) {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [reportingId, setReportingId] = useState<string | null>(null)

  const entriesById = Object.fromEntries(entries.map(e => [e.id, e]))
  const myEntry = entries.find(e => e.player_id === currentUserId)

  const hasOutstanding = challenges.some(c =>
    (c.status === 'pending' || c.status === 'accepted') &&
    (entriesById[c.challenger_entry_id]?.player_id === currentUserId || entriesById[c.defender_entry_id]?.player_id === currentUserId)
  )

  const incoming = challenges.filter(c => c.status === 'pending' && entriesById[c.defender_entry_id]?.player_id === currentUserId)
  const outgoing = challenges.filter(c => c.status === 'pending' && entriesById[c.challenger_entry_id]?.player_id === currentUserId)
  const accepted = challenges.filter(c => c.status === 'accepted' &&
    (entriesById[c.challenger_entry_id]?.player_id === currentUserId || entriesById[c.defender_entry_id]?.player_id === currentUserId))
  const recentCompleted = challenges.filter(c => c.status === 'completed').slice(0, 6)

  const handleJoin = async () => {
    setLoading('join')
    const { error } = await supabase.rpc('join_ladder', { p_ladder_id: ladder.id })
    setLoading(null)
    if (error) { toast.error(error.message || 'Could not join ladder'); return }
    toast.success("You're on the ladder!")
    router.refresh()
  }

  const handleChallenge = async (defenderEntryId: string) => {
    setLoading(defenderEntryId)
    const { error } = await supabase.rpc('create_ladder_challenge', { p_defender_entry_id: defenderEntryId })
    setLoading(null)
    if (error) { toast.error(error.message || 'Could not send challenge'); return }
    toast.success('Challenge sent!')
    router.refresh()
  }

  const handleRespond = async (challengeId: string, accept: boolean) => {
    setLoading(challengeId)
    const { error } = await supabase.rpc('respond_ladder_challenge', { p_challenge_id: challengeId, p_accept: accept })
    setLoading(null)
    if (error) { toast.error(error.message || 'Could not respond'); return }
    toast.success(accept ? 'Challenge accepted — good luck!' : 'Challenge declined')
    router.refresh()
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">{ladder.name}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Challenge anyone ranked up to {ladder.max_challenge_gap} spots above you — win, and you take their spot
        </p>
      </div>

      {!myEntry && (
        <button type="button" onClick={handleJoin} disabled={loading === 'join'}
          className="flex items-center justify-between gap-3 rounded-2xl px-5 py-[18px] mb-5 w-full transition-all hover:scale-[1.01]"
          style={{ background: 'var(--brand-primary)', color: 'var(--brand-primary-on)', boxShadow: 'var(--glow-primary)' }}>
          <div className="text-left">
            <div className="text-[17px]" style={{ fontFamily: 'var(--font-display), Manrope, sans-serif', fontWeight: 800, letterSpacing: '-0.01em' }}>
              {loading === 'join' ? 'Joining…' : '+ Join this ladder'}
            </div>
            <div className="text-xs mt-0.5" style={{ fontWeight: 600, opacity: 0.75 }}>You'll start at the bottom spot</div>
          </div>
          <div className="shrink-0 text-2xl">🪜</div>
        </button>
      )}

      {(incoming.length > 0 || accepted.length > 0 || outgoing.length > 0) && (
        <div className="rounded-2xl p-3.5 mb-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
          <div className="text-xs font-bold uppercase tracking-wide mb-2.5" style={{ color: 'var(--text-subtle)' }}>My challenges</div>
          <div className="space-y-2">
            {incoming.map(c => {
              const challenger = entriesById[c.challenger_entry_id]
              return (
                <div key={c.id} className="rounded-xl p-2.5" style={{ background: 'var(--bg-raised)' }}>
                  <div className="text-sm" style={{ color: 'var(--text-primary)' }}>
                    <strong>{playerName(challenger?.profiles ?? null)}</strong> challenged you
                  </div>
                  <div className="flex gap-1.5 mt-1.5">
                    <button type="button" onClick={() => handleRespond(c.id, true)} disabled={loading === c.id}
                      className="flex-1 py-1.5 rounded-lg text-xs font-semibold" style={{ background: 'var(--brand-primary)', color: 'var(--brand-primary-on)' }}>
                      Accept
                    </button>
                    <button type="button" onClick={() => handleRespond(c.id, false)} disabled={loading === c.id}
                      className="flex-1 py-1.5 rounded-lg text-xs font-semibold" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                      Decline
                    </button>
                  </div>
                </div>
              )
            })}
            {accepted.map(c => {
              const challenger = entriesById[c.challenger_entry_id]
              const defender = entriesById[c.defender_entry_id]
              const isChallenger = challenger?.player_id === currentUserId
              const me = isChallenger ? challenger : defender
              const opponent = isChallenger ? defender : challenger
              return (
                <div key={c.id} className="rounded-xl p-2.5" style={{ background: 'var(--bg-raised)' }}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm" style={{ color: 'var(--text-primary)' }}>
                      Match agreed vs <strong>{playerName(opponent?.profiles ?? null)}</strong>
                    </div>
                    {reportingId !== c.id && (
                      <button type="button" onClick={() => setReportingId(c.id)}
                        className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: 'var(--brand-primary-muted)', color: 'var(--brand-primary)' }}>
                        Report result
                      </button>
                    )}
                  </div>
                  {reportingId === c.id && me && opponent && (
                    <ReportForm
                      challenge={c}
                      myEntryId={me.id}
                      opponentEntryId={opponent.id}
                      opponentName={playerName(opponent.profiles)}
                      onDone={() => { setReportingId(null); router.refresh() }}
                    />
                  )}
                </div>
              )
            })}
            {outgoing.map(c => {
              const defender = entriesById[c.defender_entry_id]
              return (
                <div key={c.id} className="rounded-xl p-2.5 text-sm" style={{ background: 'var(--bg-raised)', color: 'var(--text-muted)' }}>
                  Waiting for <strong style={{ color: 'var(--text-primary)' }}>{playerName(defender?.profiles ?? null)}</strong> to respond
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {entries.length === 0 ? (
          <div className="rounded-2xl text-center py-12 text-sm" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            Nobody's on this ladder yet
          </div>
        ) : entries.map(e => {
          const isMe = e.player_id === currentUserId
          const eligible = myEntry && !isMe && !hasOutstanding &&
            myEntry.position > e.position && myEntry.position - e.position <= ladder.max_challenge_gap
          return (
            <div key={e.id} className="flex items-center gap-3 rounded-2xl p-3"
              style={{
                background: isMe ? 'var(--bg-surface)' : 'var(--bg-raised)',
                border: '1px solid var(--border)',
                boxShadow: isMe ? '0 0 0 1px var(--ring-primary), 0 30px 70px -20px var(--ring-primary)' : 'none',
              }}>
              <div className="w-7 text-center text-sm shrink-0" style={{ fontFamily: 'var(--font-display), Manrope, sans-serif', fontWeight: 700, color: 'var(--text-muted)' }}>
                {e.position}
              </div>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                background: isMe ? 'var(--brand-primary)' : 'var(--bg-surface)',
                color: isMe ? 'var(--brand-primary-on)' : 'var(--text-muted)',
                border: isMe ? 'none' : '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
              }}>
                {getInitials(playerName(e.profiles))}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm truncate" style={{ color: 'var(--text-primary)', fontWeight: isMe ? 650 : 500 }}>
                  {playerName(e.profiles)}{isMe && ' (you)'}
                </div>
                <div className="text-[11px]" style={{ color: 'var(--text-subtle)' }}>{e.wins}W – {e.losses}L</div>
              </div>
              {eligible && (
                <button type="button" onClick={() => handleChallenge(e.id)} disabled={loading === e.id}
                  className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
                  style={{ background: 'var(--brand-primary)', color: 'var(--brand-primary-on)', boxShadow: 'var(--glow-primary)' }}>
                  {loading === e.id ? '…' : 'Challenge'}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {recentCompleted.length > 0 && (
        <div className="mt-6">
          <div className="text-xs font-bold uppercase tracking-wide mb-2.5" style={{ color: 'var(--text-subtle)' }}>Recent results</div>
          <div className="space-y-1.5">
            {recentCompleted.map(c => {
              const challenger = entriesById[c.challenger_entry_id]
              const defender = entriesById[c.defender_entry_id]
              const winnerEntry = c.winner_entry_id === challenger?.id ? challenger : defender
              const loserEntry = c.winner_entry_id === challenger?.id ? defender : challenger
              return (
                <div key={c.id} className="text-xs rounded-lg px-3 py-2" style={{ background: 'var(--bg-raised)', color: 'var(--text-muted)' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>{playerName(winnerEntry?.profiles ?? null)}</strong> beat {playerName(loserEntry?.profiles ?? null)}
                  {c.score && <> · {c.score}</>}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
