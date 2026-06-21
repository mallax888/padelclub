'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { formatDate, getInitials } from '@/lib/utils'

type OpenMatch = {
  id: string
  date: string
  start_time: string
  end_time: string
  venue_slug: string
  match_type: string
  skill_min: number
  skill_max: number
  spots_total: number
  notes: string | null
  organizer_id: string
  courts: { name: string; type: string } | null
  open_match_players: {
    player_id: string
    profiles: { id: string; full_name: string | null; nickname: string | null; skill_rating: number; skill_level?: string | null } | null
  }[]
}

function skillLabel(rating: number | null | undefined, skillLevel?: string | null) {
  if (skillLevel) return skillLevel.charAt(0).toUpperCase() + skillLevel.slice(1)
  if (rating == null) return 'Beginner'
  if (rating < 2.5) return 'Beginner'
  if (rating < 4) return 'Intermediate'
  if (rating < 5.5) return 'Advanced'
  return 'Pro'
}

function skillLabelForRange(min: number, max: number) {
  const lo = skillLabel(min)
  const hi = skillLabel(max)
  return lo === hi ? lo : `${lo} – ${hi}`
}

export default function FindGameList({
  matches,
  currentUserId,
}: {
  matches: OpenMatch[]
  currentUserId: string
}) {
  const supabase = createClient()
  const router = useRouter()
  const [joining, setJoining] = useState<string | null>(null)

  const handleJoin = async (matchId: string) => {
    setJoining(matchId)
    const { error } = await (supabase as any)
      .from('open_match_players')
      .insert({ match_id: matchId, player_id: currentUserId })

    if (error) {
      toast.error(error.code === '23505' ? "You're already in this match!" : 'Could not join — please try again.')
    } else {
      toast.success("You're in! See you on the court.")
      router.refresh()
    }
    setJoining(null)
  }

  const handleLeave = async (matchId: string) => {
    setJoining(matchId)
    const { error } = await (supabase as any)
      .from('open_match_players')
      .delete()
      .eq('match_id', matchId)
      .eq('player_id', currentUserId)

    if (error) {
      toast.error('Could not leave — please try again.')
    } else {
      toast.success('Left the match.')
      router.refresh()
    }
    setJoining(null)
  }

  if (matches.length === 0) {
    return (
      <div className="rounded-xl text-center py-16"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-subtle)' }}>
        <div className="text-3xl mb-3">🎾</div>
        <div className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>No open games right now</div>
        <div className="text-xs">Book a court and make it public to be the first!</div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {matches.map(match => {
        const joinedPlayers = match.open_match_players ?? []
        const spotsLeft = match.spots_total - joinedPlayers.length
        const isJoined = joinedPlayers.some(p => p.player_id === currentUserId)
        const isOrganizer = match.organizer_id === currentUserId
        const isFull = spotsLeft <= 0

        return (
          <div key={match.id} className="rounded-xl p-5"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>

            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                  {match.courts?.name} · {match.courts?.type}
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {formatDate(match.date)} · {match.start_time.slice(0,5)}–{match.end_time.slice(0,5)}
                </div>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full capitalize"
                style={{
                  background: match.match_type === 'competitive' ? 'var(--brand-accent-muted)' : 'var(--brand-primary-muted)',
                  color: match.match_type === 'competitive' ? 'var(--brand-accent)' : 'var(--brand-primary)',
                }}>
                {match.match_type}
              </span>
            </div>

            <div className="text-xs mb-3" style={{ color: 'var(--text-subtle)' }}>
              Skill level: {skillLabelForRange(match.skill_min, match.skill_max)}
            </div>

            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex -space-x-2">
                  {joinedPlayers.map(p => (
                    <div key={p.player_id}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold"
                      style={{
                        background: 'var(--brand-primary)',
                        color: 'var(--brand-primary-on)',
                        border: '2px solid var(--bg-surface)',
                      }}
                      title={p.profiles?.nickname ?? p.profiles?.full_name ?? 'Player'}
                    >
                      {getInitials(p.profiles?.full_name ?? '?')}
                    </div>
                  ))}
                  {Array.from({ length: Math.max(spotsLeft, 0) }).map((_, i) => (
                    <div key={`empty-${i}`}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs"
                      style={{
                        background: 'var(--bg-raised)',
                        border: '2px dashed var(--border)',
                        color: 'var(--text-subtle)',
                      }}
                    >
                      +
                    </div>
                  ))}
                </div>
                <span className="text-xs ml-1" style={{ color: 'var(--text-subtle)' }}>
                  {joinedPlayers.length}/{match.spots_total} players
                </span>
              </div>

              {joinedPlayers.length > 0 && (
                <div className="space-y-1 mt-2">
                  {joinedPlayers.map(p => (
                    <div key={p.player_id} className="flex items-center justify-between text-xs">
                      <span style={{ color: 'var(--text-primary)' }}>
                        {p.profiles?.nickname ?? p.profiles?.full_name ?? 'Player'}
                        {p.player_id === match.organizer_id && (
                          <span style={{ color: 'var(--text-subtle)' }}> · organizer</span>
                        )}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                        style={{ background: 'var(--bg-raised)', color: 'var(--brand-primary)' }}
                      >
                        {skillLabel(p.profiles?.skill_rating, p.profiles?.skill_level)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {match.notes && (
              <div className="text-xs mb-4 italic" style={{ color: 'var(--text-subtle)' }}>
                "{match.notes}"
              </div>
            )}

            {isOrganizer ? (
              <div className="text-xs text-center py-2 rounded-lg"
                style={{ background: 'var(--bg-raised)', color: 'var(--text-subtle)' }}>
                You're organizing this match
              </div>
            ) : isJoined ? (
              <button
                className="btn btn-danger w-full justify-center btn-sm"
                disabled={joining === match.id}
                onClick={() => handleLeave(match.id)}
              >
                {joining === match.id ? '…' : 'Leave match'}
              </button>
            ) : (
              <button
                className="btn btn-primary w-full justify-center btn-sm"
                disabled={isFull || joining === match.id}
                onClick={() => handleJoin(match.id)}
              >
                {joining === match.id ? '…' : isFull ? 'Match full' : 'Join match'}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
