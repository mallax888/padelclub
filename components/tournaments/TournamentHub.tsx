'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { VENUES } from '@/lib/venues'
import { formatDate } from '@/lib/utils'
import { formatName, isPairFormat, isRotationFormat, normalizeSettings } from '@/lib/tournament-formats'
import {
  bracketRounds, champion, matchTeams, nextStep, pairTable, pairViews, playerName, progressLabel,
  type VMatch, type VPlayer, type VTournament,
} from '@/lib/tournament-view'
import MatchCard, { type MatchCardData } from './MatchCard'
import PairsEditor from './PairsEditor'
import Bracket from './Bracket'
import StandingsTable from './StandingsTable'

type Person = { id: string; full_name: string | null; nickname: string | null }
type Tournament = VTournament & { name: string; venue_slug: string; date: string }

const card = { background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' } as const
const h2 = 'text-sm font-extrabold uppercase tracking-wide'

export default function TournamentHub({
  tournament, tournamentPlayers, matches, allPlayers, canManage, currentUserId,
}: {
  tournament: Tournament
  tournamentPlayers: VPlayer[]
  matches: VMatch[]
  allPlayers: Person[]
  canManage: boolean
  currentUserId: string
}) {
  const router = useRouter()
  const t = tournament
  const venue = VENUES.find(v => v.slug === t.venue_slug)
  const pairFormat = isPairFormat(t.format)
  const settings = normalizeSettings(t.format, t.settings)
  const [busy, setBusy] = useState<'generate' | 'roster' | null>(null)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [showRoster, setShowRoster] = useState(tournamentPlayers.length === 0)
  const [search, setSearch] = useState('')
  const [guestText, setGuestText] = useState('')

  const step = nextStep(t, tournamentPlayers, matches)
  const progress = progressLabel(t, matches)
  const courtName = (id: string) => venue?.courts.find(c => c.id === id)?.name ?? id
  const stage = (m: VMatch) => m.stage ?? 'round'

  const mineRows = useMemo(() => new Set(tournamentPlayers.filter(p => p.player_id === currentUserId).map(p => p.id)), [tournamentPlayers, currentUserId])
  const canScore = (m: VMatch) => m.status === 'pending' && (canManage || [m.team1_player1_id, m.team1_player2_id, m.team2_player1_id, m.team2_player2_id].some(id => mineRows.has(id)))
  const toCard = (m: VMatch): MatchCardData => {
    const tm = matchTeams(m, tournamentPlayers, pairFormat)
    return { id: m.id, heading: m.label ?? `Round ${m.round_number}`, court: courtName(m.court_id), later: (m.wave ?? 1) > 1, team1: tm.team1, team2: tm.team2, score1: m.team1_score, score2: m.team2_score, done: m.status === 'completed' }
  }

  const pending = matches.filter(m => m.status !== 'completed')
  const active = pending.length ? Math.min(...pending.map(m => m.round_number)) : 0
  const toPlay = pending.filter(m => m.round_number === active)
  const doneByRound = useMemo(() => {
    const out = new Map<number, VMatch[]>()
    for (const m of matches.filter(x => x.status === 'completed')) out.set(m.round_number, [...(out.get(m.round_number) ?? []), m])
    return Array.from(out.entries()).sort((a, b) => b[0] - a[0])
  }, [matches])

  const inMatch = useMemo(() => new Set(matches.flatMap(m => [m.team1_player1_id, m.team1_player2_id, m.team2_player1_id, m.team2_player2_id])), [matches])
  const locked = t.status === 'completed' || (!isRotationFormat(t.format) && t.status !== 'draft')
  const rosterIds = new Set(tournamentPlayers.map(p => p.player_id).filter(Boolean))
  const addable = allPlayers.filter(p => !rosterIds.has(p.id) && (!search || `${p.nickname ?? ''} ${p.full_name ?? ''}`.toLowerCase().includes(search.toLowerCase())))

  const post = async (url: string, body: Record<string, unknown>) => {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({}))
    return { ok: res.ok, data }
  }
  const generate = async () => {
    setBusy('generate')
    const { ok, data } = await post('/api/tournaments/generate', { tournamentId: t.id })
    setBusy(null)
    if (!ok) { toast.error(data.error ?? 'Could not make the next matches'); return }
    toast.success(data.message ?? 'Done')
    router.refresh()
  }
  const roster = async (body: Record<string, unknown>) => {
    setBusy('roster')
    const { ok, data } = await post('/api/tournaments/roster', { tournamentId: t.id, ...body })
    setBusy(null)
    if (!ok) { toast.error(data.error ?? 'Could not change the players'); return false }
    router.refresh()
    return true
  }
  const submitScore = async (matchId: string, s1: number, s2: number) => {
    setSubmitting(matchId)
    const { ok, data } = await post('/api/tournament-match-score', { matchId, team1Score: s1, team2Score: s2 })
    setSubmitting(null)
    if (!ok) { toast.error(data.error ?? 'Could not save the score'); return }
    toast.success(data.finished ? 'Score saved. The tournament is finished!' : 'Score saved')
    router.refresh()
  }

  // ---- what to show
  const pairs = pairViews(tournamentPlayers)
  const leaderboard = [...tournamentPlayers].sort((a, b) => b.total_points - a.total_points)
  const rrTable = t.format === 'fixed_round_robin' && matches.length > 0 ? pairTable(tournamentPlayers, matches, null) : []
  const groupLabels = Array.from(new Set(pairs.map(p => p.group).filter(Boolean) as string[])).sort()
  const groupTables = t.format === 'groups_knockout' ? groupLabels.map(g => ({ g, rows: pairTable(tournamentPlayers, matches, g, settings.advance ?? 2) })) : []
  const rounds = bracketRounds(matches, tournamentPlayers)
  const byes = (() => {
    if (t.format !== 'single_elim' || rounds.length === 0) return [] as string[]
    const first = Math.min(...matches.filter(m => stage(m) === 'ko').map(m => m.round_number))
    const inFirst = new Set(matches.filter(m => stage(m) === 'ko' && m.round_number === first).flatMap(m => { const tm = matchTeams(m, tournamentPlayers, true); return [tm.pair1, tm.pair2] }))
    return pairs.filter(p => !inFirst.has(p.no)).map(p => p.name)
  })()
  const winner = (() => {
    if (t.status !== 'completed') return null
    if (t.format === 'single_elim' || t.format === 'groups_knockout') return champion(matches, tournamentPlayers)
    if (t.format === 'fixed_round_robin') return rrTable[0] ? { name: rrTable[0].name, runnerUp: rrTable[1]?.name ?? '' } : null
    return leaderboard[0] ? { name: playerName(leaderboard[0]), runnerUp: leaderboard[1] ? playerName(leaderboard[1]) : '' } : null
  })()
  const statusChip = t.status === 'in_progress' ? { label: 'Live', bg: 'var(--brand-primary-muted)', fg: 'var(--brand-primary-text)' }
    : t.status === 'completed' ? { label: 'Finished', bg: 'var(--bg-raised)', fg: 'var(--text-muted)' } : { label: 'Draft', bg: 'var(--brand-yellow-muted)', fg: 'var(--text-primary)' }
  const noTies = (m: VMatch) => stage(m) === 'ko' || stage(m) === 'third_place'

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold" data-testid="title">{t.name}</h1>
          <span className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full shrink-0 mt-1.5" style={{ background: statusChip.bg, color: statusChip.fg }} data-testid="status">{statusChip.label}</span>
        </div>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }} data-testid="subtitle">
          {formatName(t.format)} · {venue?.name ?? t.venue_slug} · {formatDate(t.date)}
        </p>
        <p className="text-sm mt-0.5 font-semibold" style={{ color: 'var(--text-primary)' }} data-testid="progress">{progress}</p>
      </div>

      {winner && (
        <div className="rounded-2xl p-4" data-testid="champion" style={{ background: 'var(--brand-yellow)', color: 'var(--brand-yellow-on)' }}>
          <div className="text-[11px] font-bold uppercase tracking-wide opacity-80">{t.format === 'americano' || t.format === 'mexicano' ? 'Top of the leaderboard' : 'Champions'}</div>
          <div className="text-xl mt-0.5" style={{ fontFamily: 'var(--font-display), Manrope, sans-serif', fontWeight: 600 }}>{winner.name}</div>
          {winner.runnerUp && <div className="text-sm mt-0.5 opacity-80">Runners-up: {winner.runnerUp}</div>}
        </div>
      )}

      {canManage && t.status !== 'completed' && (
        <div className="rounded-2xl p-4 space-y-2" style={card} data-testid="next-step">
          {step.kind === 'generate' && (
            <button className="btn btn-primary w-full justify-center py-3" disabled={busy === 'generate'} onClick={generate} data-testid="generate">
              {busy === 'generate' ? 'Working…' : step.label}
            </button>
          )}
          <p className="text-sm" style={{ color: 'var(--text-muted)' }} data-testid="hint">{step.hint}</p>
        </div>
      )}

      {canManage && pairFormat && t.status === 'draft' && matches.length === 0 && (
        <PairsEditor tournamentId={t.id} players={tournamentPlayers} usesSeeds={t.format !== 'fixed_round_robin'} onChanged={() => router.refresh()} />
      )}

      {canManage && (
        <div className="rounded-2xl p-4" style={card} data-testid="roster">
          <button onClick={() => setShowRoster(!showRoster)} className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--text-muted)' }} aria-expanded={showRoster}>
            <span aria-hidden>{showRoster ? '▼' : '▶'}</span><span>Players ({tournamentPlayers.length})</span>
          </button>
          {showRoster && (
            <div className="mt-3 space-y-3">
              {locked && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t.status === 'completed' ? 'This tournament is finished.' : 'The players are fixed once this format has started.'}</p>}
              {tournamentPlayers.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tournamentPlayers.map(p => (
                    <span key={p.id} className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full" data-testid="roster-chip"
                      style={{ background: 'var(--bg-raised)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                      {playerName(p)}
                      {!locked && !inMatch.has(p.id) && <button aria-label={`Remove ${playerName(p)}`} disabled={busy === 'roster'} onClick={() => roster({ action: 'remove', rowId: p.id })} style={{ color: 'var(--brand-crimson)' }}>×</button>}
                    </span>
                  ))}
                </div>
              )}
              {!locked && (
                <>
                  <div className="flex gap-2">
                    <input type="text" className="input text-sm flex-1" placeholder="Add a guest without an account" maxLength={40} value={guestText} onChange={e => setGuestText(e.target.value)}
                      onKeyDown={async e => { if (e.key === 'Enter' && guestText.trim()) { e.preventDefault(); if (await roster({ action: 'add', guestName: guestText })) setGuestText('') } }} data-testid="roster-guest" />
                    <button className="btn btn-sm" disabled={busy === 'roster' || !guestText.trim()} onClick={async () => { if (await roster({ action: 'add', guestName: guestText })) setGuestText('') }} data-testid="roster-add-guest">Add</button>
                  </div>
                  <input type="search" className="input text-sm" placeholder="Search club members" value={search} onChange={e => setSearch(e.target.value)} />
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {addable.map(p => (
                      <button key={p.id} onClick={() => roster({ action: 'add', playerId: p.id })} disabled={busy === 'roster'}
                        className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left text-sm" style={{ background: 'var(--bg-raised)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                        {p.nickname ?? p.full_name}<span style={{ color: 'var(--brand-primary-text)' }}>+</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* the pairs, for everyone, once they exist and the pairs are not being edited */}
      {pairFormat && pairs.length > 0 && !(canManage && t.status === 'draft' && matches.length === 0) && (
        <details className="rounded-2xl p-4" style={card} data-testid="pairs-view">
          <summary className="text-sm font-bold" style={{ color: 'var(--text-muted)', cursor: 'pointer' }}>Pairs ({pairs.length})</summary>
          <ol className="mt-3 space-y-1">
            {pairs.map(p => <li key={p.no} className="text-sm flex gap-2" style={{ color: 'var(--text-primary)' }}><span className="w-5 font-bold" style={{ color: 'var(--brand-primary-text)' }}>{p.seed}</span>{p.name}</li>)}
          </ol>
        </details>
      )}

      {toPlay.length > 0 && (
        <div data-testid="to-play">
          <h2 className={`${h2} mb-2`} style={{ color: 'var(--text-primary)' }}>To play{isRotationFormat(t.format) ? `: round ${active}` : ''}</h2>
          <div className="space-y-2">
            {toPlay.map(m => <MatchCard key={m.id} m={toCard(m)} canScore={canScore(m)} noTies={noTies(m)} submitting={submitting === m.id} onSubmit={submitScore} />)}
          </div>
        </div>
      )}

      {rrTable.length > 0 && <StandingsTable title="Standings" rows={rrTable} testId="rr-table" />}

      {groupTables.length > 0 && (
        <div className="space-y-3" data-testid="group-tables">
          {groupTables.map(({ g, rows }) => <StandingsTable key={g} title={`Group ${g}`} rows={rows} testId={`group-${g}`} />)}
        </div>
      )}

      {rounds.length > 0 && (
        <div className="rounded-2xl p-4" style={card}>
          <h2 className={`${h2} mb-3`} style={{ color: 'var(--text-primary)' }}>{t.format === 'groups_knockout' ? 'Knockout' : 'Bracket'}</h2>
          <Bracket rounds={rounds} byes={byes} />
        </div>
      )}

      {isRotationFormat(t.format) && leaderboard.length > 0 && matches.length > 0 && (
        <div className="rounded-2xl p-4" style={card} data-testid="leaderboard">
          <h2 className={`${h2} mb-3`} style={{ color: 'var(--text-primary)' }}>Leaderboard</h2>
          <div className="space-y-1.5">
            {leaderboard.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 text-sm">
                <span className="w-5 text-center font-bold" style={{ color: i < 3 ? 'var(--brand-primary-text)' : 'var(--text-muted)' }}>{i + 1}</span>
                <span className="flex-1 font-medium" style={{ color: 'var(--text-primary)' }}>{playerName(p)}</span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.games_won}/{p.games_played} won</span>
                <span className="tabular-nums" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display), Manrope, sans-serif', fontWeight: 500 }}>{p.total_points}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {doneByRound.length > 0 && (
        <div className="space-y-2" data-testid="results">
          <h2 className={h2} style={{ color: 'var(--text-primary)' }}>Results</h2>
          {doneByRound.map(([round, ms], i) => (
            <details key={round} open={i === 0} className="rounded-2xl p-3" style={card}>
              <summary className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)', cursor: 'pointer' }}>
                {ms[0].stage === 'group' ? `Group stage, round ${round}` : ms.some(m => stage(m) === 'ko') ? ms.find(m => stage(m) === 'ko')?.label ?? `Round ${round}` : `Round ${round}`} ({ms.length})
              </summary>
              <div className="space-y-2 mt-2">{ms.map(m => <MatchCard key={m.id} m={toCard(m)} canScore={false} noTies={false} submitting={false} onSubmit={submitScore} />)}</div>
            </details>
          ))}
        </div>
      )}
    </div>
  )
}
