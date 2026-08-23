'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { formatDate, getInitials } from '@/lib/utils'
import { skillLabelForRating } from '@/lib/skill-levels'

type MatchPlayer = {
  id: string
  player_id: string
  status: string
  profiles: { id: string; full_name: string | null; nickname: string | null; skill_rating: number; skill_level?: string | null; email?: string | null } | null
}

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
  open_match_players: MatchPlayer[]
}

// Always derived from the numeric skill_rating (kept accurate by actual
// match results, see lib/elo.ts) rather than the self-declared skill_level
// string -- that string is what caused "over-ranked" pairing complaints,
// since it's set once at onboarding and nothing ever corrected it.
function skillLabelForRange(min: number, max: number) {
  const lo = skillLabelForRating(min)
  const hi = skillLabelForRating(max)
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
  const [loading, setLoading] = useState<string | null>(null)

  const handleRequest = async (match: OpenMatch) => {
    setLoading(match.id + '-request')

    const { error } = await supabase
      .from('open_match_players')
      .insert({ match_id: match.id, player_id: currentUserId, status: 'pending' })

    if (error) {
      toast.error(error.code === '23505' ? "You've already requested to join!" : 'Could not send request — please try again.')
      setLoading(null)
      return
    }

    toast.success('Request sent! Waiting for the organizer to accept.')

    // Get current user profile
    const { data: myProfile } = await supabase
      .from('profiles')
      .select('full_name, nickname, email')
      .eq('id', currentUserId)
      .single()

    const myName = myProfile?.nickname ?? myProfile?.full_name ?? 'A player'
    const matchUrl = `${window.location.origin}/find-a-game`
    const courtName = match.courts?.name ?? 'Court'
    const matchDate = formatDate(match.date)
    const matchTime = `${match.start_time.slice(0,5)}–${match.end_time.slice(0,5)}`

    // Notify organizer
    const organizer = match.open_match_players.find(p => p.player_id === match.organizer_id)
    if (organizer?.profiles?.email) {
      try {
        await fetch('/api/notify-join-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizerId: match.organizer_id,
            organizerEmail: organizer.profiles.email,
            organizerName: organizer.profiles.nickname ?? organizer.profiles.full_name ?? 'Organizer',
            playerName: myName,
            court: courtName,
            date: matchDate,
            time: matchTime,
            matchUrl,
          }),
        })
      } catch {}
    }

    router.refresh()
    setLoading(null)
  }

  const handleResponse = async (match: OpenMatch, playerId: string, accept: boolean) => {
    setLoading(match.id + '-' + playerId)

    const request = match.open_match_players.find(p => p.player_id === playerId)
    if (!request) {
      toast.error('Request not found')
      setLoading(null)
      return
    }

    if (accept) {
      // accept_match_player re-checks capacity and locks the match row
      // server-side, so two requests accepted at nearly the same moment
      // can't both slip through and overfill the match.
      const { data: accepted, error } = await supabase.rpc('accept_match_player', { p_request_id: request.id })
      if (error) {
        toast.error('Could not accept — please try again.')
        setLoading(null)
        return
      }
      if (!accepted) {
        toast.error('This match just filled up.')
        setLoading(null)
        router.refresh()
        return
      }
    } else {
      const { error } = await supabase
        .from('open_match_players')
        .update({ status: 'declined' })
        .eq('match_id', match.id)
        .eq('player_id', playerId)
      if (error) {
        toast.error('Could not update request')
        setLoading(null)
        return
      }
    }

    toast.success(accept ? 'Player accepted!' : 'Request declined.')

    const matchUrl = `${window.location.origin}/find-a-game`
    const courtName = match.courts?.name ?? 'Court'
    const matchDate = formatDate(match.date)
    const matchTime = `${match.start_time.slice(0,5)}–${match.end_time.slice(0,5)}`

    // Notify player of response
    const player = match.open_match_players.find(p => p.player_id === playerId)
    if (player?.profiles?.email) {
      try {
        await fetch('/api/notify-join-response', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerEmail: player.profiles.email,
            playerName: player.profiles.nickname ?? player.profiles.full_name ?? 'Player',
            accepted: accept,
            court: courtName,
            date: matchDate,
            time: matchTime,
            matchUrl,
          }),
        })
      } catch {}
    }

    // If accepted, let the organizer know this player has joined
    if (accept) {
      const organizer = match.open_match_players.find(p => p.player_id === match.organizer_id)
      if (organizer?.profiles?.email) {
        try {
          await fetch('/api/notify-player-joined', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              organizerEmail: organizer.profiles.email,
              organizerName: organizer.profiles.nickname ?? organizer.profiles.full_name ?? 'Organizer',
              playerName: player?.profiles?.nickname ?? player?.profiles?.full_name ?? 'A player',
              court: courtName,
              date: matchDate,
              time: matchTime,
              matchUrl,
            }),
          })
        } catch {}
      }
    }

    // If accepted and match is now full, notify all accepted players
    if (accept) {
      const acceptedPlayers = match.open_match_players.filter(p =>
        p.status === 'accepted' || p.player_id === playerId
      )

      if (acceptedPlayers.length >= match.spots_total) {
        // accept_match_player already flipped open_matches to 'full' -- this
        // branch only decides whether to send the "match is full" emails.
        const recipients = acceptedPlayers
          .filter(p => p.profiles?.email)
          .map(p => ({ email: p.profiles!.email as string, name: p.profiles?.nickname ?? p.profiles?.full_name ?? 'Player' }))

        if (recipients.length > 0) {
          try {
            await fetch('/api/notify-match-full', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                players: recipients,
                court: courtName,
                date: matchDate,
                time: matchTime,
                matchUrl,
              }),
            })
          } catch {}
        }
      }
    }

    router.refresh()
    setLoading(null)
  }

  const handleLeave = async (matchId: string) => {
    setLoading(matchId + '-leave')
    const { error } = await supabase
      .from('open_match_players')
      .delete()
      .eq('match_id', matchId)
      .eq('player_id', currentUserId)

    if (error) {
      toast.error('Could not leave match')
    } else {
      toast.success('Left the match.')
      router.refresh()
    }
    setLoading(null)
  }

  if (matches.length === 0) {
    return (
      <div className="rounded-xl text-center py-16"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-subtle)' }}>
        <svg width="40" height="40" viewBox="0 0 48 48" className="mx-auto mb-3">
          <g transform="rotate(-14 24 20)">
            <rect x="21" y="26" width="6" height="16" rx="2.5" fill="var(--brand-accent)"/>
            <rect x="10" y="4" width="22" height="28" rx="11" fill="var(--brand-accent)"/>
            {[15, 21, 27].map(cx => [10, 15.5, 21, 26.5].map(cy => (
              <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.3" fill="var(--bg-surface)"/>
            )))}
          </g>
          <circle cx="38" cy="38" r="5" fill="var(--brand-primary)"/>
          <path d="M35 38a3 3 0 0 1 6 0" stroke="var(--bg-surface)" strokeWidth="0.8" fill="none"/>
        </svg>
        <div className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>No open games right now</div>
        <div className="text-xs">Book a court and make it public to be the first!</div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {matches.map(match => {
        const allPlayers = match.open_match_players ?? []
        const acceptedPlayers = allPlayers.filter(p => p.status === 'accepted')
        const pendingPlayers = allPlayers.filter(p => p.status === 'pending' && p.player_id !== match.organizer_id)
        const spotsLeft = match.spots_total - acceptedPlayers.length
        const isOrganizer = match.organizer_id === currentUserId
        const myEntry = allPlayers.find(p => p.player_id === currentUserId)
        const isFull = spotsLeft <= 0

        return (
          <div key={match.id} className="rounded-2xl p-5"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>

            {/* Header */}
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
                  color: match.match_type === 'competitive' ? 'var(--brand-accent)' : 'var(--brand-primary-text)',
                }}>
                {match.match_type}
              </span>
            </div>

            {/* Skill range */}
            <div className="text-xs mb-3" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
              Skill level: {skillLabelForRange(match.skill_min, match.skill_max)}
            </div>

            {/* Accepted players */}
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex -space-x-2">
                  {acceptedPlayers.map(p => (
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
                        border: '2px dashed rgba(128,128,128,0.5)',
                        color: 'rgba(128,128,128,0.9)',
                        fontWeight: 700,
                      }}
                    >
                      +
                    </div>
                  ))}
                </div>
                <span className="text-xs ml-1" style={{ color: 'var(--text-subtle)' }}>
                  {acceptedPlayers.length}/{match.spots_total} players
                </span>
              </div>

              {/* Accepted player list */}
              {acceptedPlayers.length > 0 && (
                <div className="space-y-1">
                  {acceptedPlayers.map(p => (
                    <div key={p.player_id} className="flex items-center justify-between text-xs">
                      <span style={{ color: 'var(--text-primary)' }}>
                        {p.profiles?.nickname ?? p.profiles?.full_name ?? 'Player'}
                        {p.player_id === match.organizer_id && (
                          <span style={{ color: 'var(--text-subtle)' }}> · organizer</span>
                        )}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                        style={{ background: 'var(--bg-raised)', color: 'var(--brand-primary-text)' }}>
                        {skillLabelForRating(p.profiles?.skill_rating)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pending requests — only visible to organizer */}
            {isOrganizer && pendingPlayers.length > 0 && (
              <div className="rounded-lg p-3 mb-3"
                style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
                <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                  {pendingPlayers.length} pending request{pendingPlayers.length > 1 ? 's' : ''}
                </div>
                {pendingPlayers.map(p => (
                  <div key={p.player_id} className="flex items-center justify-between gap-2 py-1.5"
                    style={{ borderTop: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                        {getInitials(p.profiles?.full_name ?? '?')}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                          {p.profiles?.nickname ?? p.profiles?.full_name ?? 'Player'}
                        </div>
                        <div className="text-[10px]" style={{ color: 'var(--text-subtle)' }}>
                          {skillLabelForRating(p.profiles?.skill_rating)}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        className="text-xs px-2.5 py-1 rounded-lg font-medium transition-all"
                        style={{ background: 'var(--brand-primary)', color: 'var(--brand-primary-on)' }}
                        disabled={loading === match.id + '-' + p.player_id}
                        onClick={() => handleResponse(match, p.player_id, true)}
                      >
                        Accept
                      </button>
                      <button
                        className="text-xs px-2.5 py-1 rounded-lg font-medium transition-all"
                        style={{ background: 'var(--brand-accent-muted)', color: 'var(--brand-accent)' }}
                        disabled={loading === match.id + '-' + p.player_id}
                        onClick={() => handleResponse(match, p.player_id, false)}
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {match.notes && (
              <div className="text-xs mb-3 italic" style={{ color: 'var(--text-subtle)' }}>
                "{match.notes}"
              </div>
            )}

            {/* Action button */}
            {isOrganizer ? (
              <div className="text-xs text-center py-2 rounded-lg"
                style={{ background: 'var(--bg-raised)', color: 'var(--text-primary)', fontWeight: 600 }}>
                You're organizing this match
              </div>
            ) : myEntry?.status === 'accepted' ? (
              <button
                className="btn btn-danger w-full justify-center btn-sm"
                disabled={loading === match.id + '-leave'}
                onClick={() => handleLeave(match.id)}
              >
                {loading === match.id + '-leave' ? '…' : 'Leave match'}
              </button>
            ) : myEntry?.status === 'pending' ? (
              <div className="text-xs text-center py-2 rounded-lg"
                style={{ background: 'var(--brand-primary-muted)', color: 'var(--brand-primary-text)' }}>
                Request pending — waiting for organizer
              </div>
            ) : (
              <button
                className="btn btn-primary w-full justify-center btn-sm"
                disabled={isFull || loading === match.id + '-request'}
                onClick={() => handleRequest(match)}
              >
                {loading === match.id + '-request' ? '…' : isFull ? 'Match full' : 'Request to join'}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}



