'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import toast from 'react-hot-toast'
import { VENUES } from '@/lib/venues'
import { formatDate } from '@/lib/utils'
import { pairAmericanoRound } from '@/lib/tournament'
import type { Tournament, TournamentMatch } from '@/types/database'

type Player = { id: string; full_name: string | null; nickname: string | null }
type TournamentPlayerRow = {
  id: string
  tournament_id: string
  player_id: string | null
  guest_name: string | null
  total_points: number
  games_played: number
  games_won: number
  profiles: { full_name: string | null; nickname: string | null } | null
}

export default function TournamentHub({
  tournament,
  tournamentPlayers,
  matches,
  allPlayers,
  isStaff,
  currentUserId,
}: {
  tournament: Tournament
  tournamentPlayers: TournamentPlayerRow[]
  matches: TournamentMatch[]
  allPlayers: Player[]
  isStaff: boolean
  currentUserId: string
}) {
  const supabase = createClient()
  const router = useRouter()
  const venue = VENUES.find(v => v.slug === tournament.venue_slug)
  const [generating, setGenerating] = useState(false)
  const [showRoster, setShowRoster] = useState(tournamentPlayers.length === 0)
  const [addingPlayerId, setAddingPlayerId] = useState<string | null>(null)
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, { t1: string; t2: string }>>({})
  const [submittingMatch, setSubmittingMatch] = useState<string | null>(null)

  const playerName = (rowId: string) => {
    const p = tournamentPlayers.find(tp => tp.id === rowId)
    if (!p) return 'Player'
    return p.guest_name ?? p.profiles?.nickname ?? p.profiles?.full_name ?? 'Player'
  }

  const courtName = (courtId: string) => venue?.courts.find(c => c.id === courtId)?.name ?? courtId

  const currentRoundMatches = matches.filter(m => m.round_number === tournament.current_round)
  const pastRounds = useMemo(() => {
    const rounds: Record<number, TournamentMatch[]> = {}
    matches.filter(m => m.round_number < tournament.current_round).forEach(m => {
      rounds[m.round_number] = rounds[m.round_number] ?? []
      rounds[m.round_number].push(m)
    })
    return rounds
  }, [matches, tournament.current_round])

  const canGenerateNext =
    isStaff &&
    tournament.current_round < tournament.total_rounds &&
    tournamentPlayers.length >= 4 &&
    tournament.court_ids.length > 0 &&
    (tournament.current_round === 0 || (currentRoundMatches.length > 0 && currentRoundMatches.every(m => m.status === 'completed')))

  const leaderboard = [...tournamentPlayers].sort((a, b) => b.total_points - a.total_points)

  const handleGenerateRound = async () => {
    setGenerating(true)
    const nextRound = tournament.current_round + 1
    const playerRowIds = tournamentPlayers.map(p => p.id)
    const { pairings, sittingOut } = pairAmericanoRound(playerRowIds, tournament.court_ids)

    if (pairings.length === 0) {
      toast.error('Not enough players or courts to generate a round')
      setGenerating(false)
      return
    }

    const rows = pairings.map(p => ({
      tournament_id: tournament.id,
      round_number: nextRound,
      court_id: p.courtId,
      team1_player1_id: p.team1[0],
      team1_player2_id: p.team1[1],
      team2_player1_id: p.team2[0],
      team2_player2_id: p.team2[1],
    }))

    const { error: insertError } = await supabase.from('tournament_matches').insert(rows)
    if (insertError) {
      toast.error('Could not generate the round — please try again')
      setGenerating(false)
      return
    }
    await supabase.from('tournaments').update({ current_round: nextRound, status: 'in_progress' }).eq('id', tournament.id)
    toast.success(`Round ${nextRound} generated${sittingOut.length > 0 ? ` — ${sittingOut.length} sitting out` : ''}`)
    router.refresh()
    setGenerating(false)
  }

  const handleAddPlayer = async (playerId: string) => {
    setAddingPlayerId(playerId)
    const { error } = await supabase.from('tournament_players').insert({ tournament_id: tournament.id, player_id: playerId })
    if (error) toast.error('Could not add player')
    router.refresh()
    setAddingPlayerId(null)
  }

  const handleRemovePlayer = async (rowId: string) => {
    const { error } = await supabase.from('tournament_players').delete().eq('id', rowId)
    if (error) toast.error('Could not remove player')
    router.refresh()
  }

  const handleSubmitScore = async (matchId: string) => {
    const draft = scoreDrafts[matchId]
    const t1 = Number(draft?.t1)
    const t2 = Number(draft?.t2)
    if (!draft || draft.t1 === '' || draft.t2 === '' || Number.isNaN(t1) || Number.isNaN(t2)) {
      toast.error('Enter both scores')
      return
    }
    setSubmittingMatch(matchId)
    const res = await fetch('/api/tournament-match-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId, team1Score: t1, team2Score: t2 }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? 'Could not save score')
      setSubmittingMatch(null)
      return
    }
    toast.success('Score saved')
    router.refresh()
    setSubmittingMatch(null)
  }

  const rosterPlayerIds = new Set(tournamentPlayers.map(p => p.player_id).filter(Boolean))
  const addablePlayers = allPlayers.filter(p => !rosterPlayerIds.has(p.id))

  const MatchCard = ({ m }: { m: TournamentMatch }) => {
    const draft = scoreDrafts[m.id] ?? { t1: '', t2: '' }
    const isParticipant = tournamentPlayers.some(
      tp => [m.team1_player1_id, m.team1_player2_id, m.team2_player1_id, m.team2_player2_id].includes(tp.id) && tp.player_id === currentUserId
    )
    const canScore = m.status === 'pending' && (isStaff || isParticipant)

    return (
      <div className="rounded-xl p-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <div className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>{courtName(m.court_id)}</div>
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold min-w-0" style={{ color: 'var(--text-primary)' }}>
            {playerName(m.team1_player1_id)} / {playerName(m.team1_player2_id)}
          </div>
          {m.status === 'completed' ? (
            <div className="text-lg font-black shrink-0" style={{ color: 'var(--brand-primary)' }}>{m.team1_score}</div>
          ) : canScore ? (
            <input type="number" min={0} className="input text-sm text-center" style={{ width: 56 }}
              value={draft.t1} onChange={e => setScoreDrafts(prev => ({ ...prev, [m.id]: { t1: e.target.value, t2: prev[m.id]?.t2 ?? '' } }))} />
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-2 mt-1.5">
          <div className="text-sm font-semibold min-w-0" style={{ color: 'var(--text-primary)' }}>
            {playerName(m.team2_player1_id)} / {playerName(m.team2_player2_id)}
          </div>
          {m.status === 'completed' ? (
            <div className="text-lg font-black shrink-0" style={{ color: 'var(--brand-accent)' }}>{m.team2_score}</div>
          ) : canScore ? (
            <input type="number" min={0} className="input text-sm text-center" style={{ width: 56 }}
              value={draft.t2} onChange={e => setScoreDrafts(prev => ({ ...prev, [m.id]: { t1: prev[m.id]?.t1 ?? '', t2: e.target.value } }))} />
          ) : null}
        </div>
        {canScore && (
          <button className="btn btn-primary btn-sm w-full justify-center mt-2" disabled={submittingMatch === m.id} onClick={() => handleSubmitScore(m.id)}>
            {submittingMatch === m.id ? 'Saving…' : 'Confirm score'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">{tournament.name}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {venue?.name ?? tournament.venue_slug} · {formatDate(tournament.date)}
          {tournament.current_round > 0 && ` · Round ${tournament.current_round} of ${tournament.total_rounds}`}
        </p>
      </div>

      {isStaff && (
        <div className="rounded-2xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <button onClick={() => setShowRoster(!showRoster)} className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--text-muted)' }}>
            <span>{showRoster ? '▼' : '▶'}</span>
            <span>Players ({tournamentPlayers.length})</span>
          </button>
          {showRoster && (
            <div className="mt-3 space-y-3">
              {tournamentPlayers.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tournamentPlayers.map(p => (
                    <span key={p.id} className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ background: 'var(--bg-raised)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                      {p.guest_name ?? p.profiles?.nickname ?? p.profiles?.full_name ?? 'Player'}
                      <button onClick={() => handleRemovePlayer(p.id)} style={{ color: 'var(--brand-crimson)' }}>×</button>
                    </span>
                  ))}
                </div>
              )}
              {addablePlayers.length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {addablePlayers.map(p => (
                    <button key={p.id} onClick={() => handleAddPlayer(p.id)} disabled={addingPlayerId === p.id}
                      className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left text-sm"
                      style={{ background: 'var(--bg-raised)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                      {p.nickname ?? p.full_name}
                      <span style={{ color: 'var(--brand-primary)' }}>{addingPlayerId === p.id ? '…' : '+'}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {isStaff && canGenerateNext && (
        <button className="btn btn-primary w-full justify-center py-3" disabled={generating} onClick={handleGenerateRound}>
          {generating ? 'Generating…' : `Generate round ${tournament.current_round + 1}`}
        </button>
      )}

      {currentRoundMatches.length > 0 && (
        <div>
          <h2 className="text-sm font-extrabold uppercase tracking-wide mb-2" style={{ color: 'var(--text-primary)' }}>Round {tournament.current_round}</h2>
          <div className="space-y-2">
            {currentRoundMatches.map(m => <MatchCard key={m.id} m={m} />)}
          </div>
        </div>
      )}

      {leaderboard.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <h2 className="text-sm font-extrabold uppercase tracking-wide mb-3" style={{ color: 'var(--text-primary)' }}>Leaderboard</h2>
          <div className="space-y-1.5">
            {leaderboard.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 text-sm">
                <span className="w-5 text-center font-bold" style={{ color: i < 3 ? 'var(--brand-primary)' : 'var(--text-muted)' }}>{i + 1}</span>
                <span className="flex-1 font-medium" style={{ color: 'var(--text-primary)' }}>{p.guest_name ?? p.profiles?.nickname ?? p.profiles?.full_name ?? 'Player'}</span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.games_won}/{p.games_played} won</span>
                <span className="font-black" style={{ color: 'var(--text-primary)' }}>{p.total_points}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {Object.keys(pastRounds).length > 0 && (
        <div className="space-y-3">
          {Object.entries(pastRounds).sort((a, b) => Number(b[0]) - Number(a[0])).map(([round, roundMatches]) => (
            <div key={round}>
              <h3 className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Round {round}</h3>
              <div className="space-y-2">
                {roundMatches.map(m => <MatchCard key={m.id} m={m} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
