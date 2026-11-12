// How many matches each player has recorded, so Open play can say whether a
// rating is settled ("Reliable") or still "New". Counted from the four team
// columns of the matches table: a player appears in one of them per match.
// Returns null if the counts can't be read, in which case nothing about
// reliability is shown.
import type { SupabaseClient } from '@supabase/supabase-js'

const TEAM_COLUMNS = ['team1_player1_id', 'team1_player2_id', 'team2_player1_id', 'team2_player2_id'] as const

export async function loadMatchCounts(db: SupabaseClient<any>, playerIds: string[]): Promise<Record<string, number> | null> {
  const ids = Array.from(new Set(playerIds.filter(Boolean)))
  if (ids.length === 0) return {}
  const results = await Promise.all(TEAM_COLUMNS.map(col => (db as any).from('matches').select(`id, ${col}`).in(col, ids).limit(5000)))
  if (results.some(r => r.error)) return null
  const counts: Record<string, number> = Object.fromEntries(ids.map(id => [id, 0]))
  results.forEach((r, i) => {
    for (const row of (r.data ?? []) as any[]) {
      const id = row[TEAM_COLUMNS[i]]
      if (id in counts) counts[id]++
    }
  })
  return counts
}
