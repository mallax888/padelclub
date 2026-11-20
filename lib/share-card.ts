// What gets shared when a tournament is posted: a short, names-only summary. Pure (no database, no React) so the
// wording and the privacy rule (first name and last initial, never an email or number) are tested on their own.
import { champion, pairTable, playerName, type VMatch, type VPlayer, type VTournament } from '@/lib/tournament-view'
import { formatName, isRotationFormat } from '@/lib/tournament-formats'

export type ShareRow = { rank: number; name: string; score: number | null }
export type ShareSummary = { heading: string; rows: ShareRow[]; finished: boolean; detail: string }

// "Ana Moffett" -> "Ana M."; a single name stays as it is.
export function publicName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return parts[0] ?? 'Player'
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`
}

export function shareSummary(t: VTournament, players: VPlayer[], matches: VMatch[]): ShareSummary {
  const finished = t.status === 'completed'
  const scored = matches.filter(m => m.status === 'completed').length
  if (isRotationFormat(t.format)) {
    const top = [...players].sort((a, b) => b.total_points - a.total_points).slice(0, 3)
    return {
      heading: finished ? 'Final leaderboard' : 'Leaderboard so far', finished,
      rows: scored === 0 ? [] : top.map((p, i) => ({ rank: i + 1, name: publicName(playerName(p)), score: p.total_points })),
      detail: `${formatName(t.format)} · ${players.length} players · ${t.total_rounds} rounds`,
    }
  }
  if (t.format === 'fixed_round_robin') {
    const rows = scored === 0 ? [] : pairTable(players, matches, null).slice(0, 3).map((r, i) => ({ rank: i + 1, name: r.name, score: r.points }))
    return { heading: finished ? 'Final table' : 'Table so far', finished, rows, detail: `${formatName(t.format)} · ${players.length / 2} pairs` }
  }
  const win = finished ? champion(matches, players) : null
  return {
    heading: win ? 'Champions' : 'In progress', finished,
    rows: win ? [{ rank: 1, name: win.name, score: null }, ...(win.runnerUp ? [{ rank: 2, name: win.runnerUp, score: null }] : [])] : [],
    detail: `${formatName(t.format)} · ${players.length / 2} pairs`,
  }
}
