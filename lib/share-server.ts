// Server-only: loads a tournament for the public share page and picture. Uses the service role because anyone
// holding the link may look, so it only ever hands back names, scores and the club, never contact details.
import { getVenue } from '@/lib/venues'
import { formatDate } from '@/lib/utils'
import { publicName, shareSummary, type ShareSummary } from '@/lib/share-card'
import { playerName } from '@/lib/tournament-view'
import { isRotationFormat } from '@/lib/tournament-formats'

export type SharedTournament = { id: string; name: string; club: string; date: string; summary: ShareSummary; players: { name: string; points: number; played: number; won: number }[]; live: boolean; rotation: boolean }

export async function loadShared(admin: any, id: string): Promise<SharedTournament | null> {
  if (!/^[0-9a-zA-Z_-]{3,64}$/.test(id)) return null
  const { data: t } = await admin.from('tournaments').select('*').eq('id', id).maybeSingle()
  if (!t) return null
  const [{ data: players }, { data: matches }] = await Promise.all([
    admin.from('tournament_players').select('*, profiles(full_name, nickname)').eq('tournament_id', id),
    admin.from('tournament_matches').select('*').eq('tournament_id', id).order('round_number', { ascending: true }),
  ])
  const summary = shareSummary(t, (players ?? []) as any, (matches ?? []) as any)
  const rows = ((players ?? []) as any[]).map(p => ({ name: publicName(playerName(p)), points: p.total_points ?? 0, played: p.games_played ?? 0, won: p.games_won ?? 0 }))
    .sort((a, b) => b.points - a.points)
  return { id: t.id, name: t.name, club: getVenue(t.venue_slug)?.name ?? 'PadelMate', date: formatDate(t.date), summary, players: rows, live: t.status === 'in_progress', rotation: isRotationFormat(t.format) }
}
