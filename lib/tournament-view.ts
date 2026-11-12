// What the tournament screens show, worked out from the saved rows. Pure functions (no
// database, no React) so the rules for "what happens next" and "who is on top" are tested
// on their own. The rules of the formats themselves are in lib/tournament-engine.ts.
import { standings, type Result, type Standing } from '@/lib/tournament-engine'
import { isPairFormat, isRotationFormat, normalizeSettings } from '@/lib/tournament-formats'

export type VPlayer = {
  id: string; player_id: string | null; guest_name: string | null
  total_points: number; games_played: number; games_won: number
  pair_no?: number | null; group_label?: string | null; seed?: number | null
  profiles?: { full_name: string | null; nickname: string | null } | null
}
export type VMatch = {
  id: string; round_number: number; court_id: string; status: string
  team1_player1_id: string; team1_player2_id: string; team2_player1_id: string; team2_player2_id: string
  team1_score: number | null; team2_score: number | null
  stage?: string | null; label?: string | null; match_number?: number | null; group_label?: string | null; wave?: number | null
}
export type VTournament = {
  id: string; format: string; status: string; court_ids: string[]; total_rounds: number; current_round: number; settings?: unknown
}

export const playerName = (p: VPlayer | undefined): string => (p ? p.guest_name ?? p.profiles?.nickname ?? p.profiles?.full_name ?? 'Player' : 'Player')
const first = (s: string): string => s.split(' ')[0]
const stageOf = (m: VMatch): string => m.stage ?? 'round'
const isDone = (m: VMatch): boolean => m.status === 'completed'

export type PairView = { no: number; seed: number; group: string | null; rows: [VPlayer, VPlayer]; name: string }

// Complete pairs, best seed first. Players without a partner yet are not included.
export function pairViews(players: VPlayer[]): PairView[] {
  const byNo = new Map<number, VPlayer[]>()
  for (const p of players) if (p.pair_no != null) byNo.set(p.pair_no, [...(byNo.get(p.pair_no) ?? []), p])
  const out: PairView[] = []
  for (const [no, rows] of Array.from(byNo)) {
    if (rows.length !== 2) continue
    out.push({ no, seed: rows[0].seed ?? no, group: rows[0].group_label ?? null, rows: [rows[0], rows[1]], name: `${first(playerName(rows[0]))} & ${first(playerName(rows[1]))}` })
  }
  return out.sort((a, b) => a.seed - b.seed || a.no - b.no)
}
export const unpaired = (players: VPlayer[]): VPlayer[] => players.filter(p => p.pair_no == null)

export type Teams = { team1: string; team2: string; pair1: number | null; pair2: number | null }
// Who is on each side of a match. Pair formats show the pair; rotation formats show the two names.
export function matchTeams(m: VMatch, players: VPlayer[], pairFormat: boolean): Teams {
  const by = new Map(players.map(p => [p.id, p]))
  const nm = (id: string) => playerName(by.get(id))
  if (pairFormat) {
    const no = (id: string) => by.get(id)?.pair_no ?? null
    const label = (a: string, b: string) => `${first(nm(a))} & ${first(nm(b))}`
    return { team1: label(m.team1_player1_id, m.team1_player2_id), team2: label(m.team2_player1_id, m.team2_player2_id), pair1: no(m.team1_player1_id), pair2: no(m.team2_player1_id) }
  }
  return { team1: `${nm(m.team1_player1_id)} / ${nm(m.team1_player2_id)}`, team2: `${nm(m.team2_player1_id)} / ${nm(m.team2_player2_id)}`, pair1: null, pair2: null }
}

export type TableRow = Standing & { name: string; no: number; qualifies: boolean }

// The table for a whole round robin (group = null) or one group.
export function pairTable(players: VPlayer[], matches: VMatch[], group: string | null, advance = 0): TableRow[] {
  const pairs = pairViews(players).filter(p => (group == null ? true : p.group === group))
  const byNo = new Map(players.filter(p => p.pair_no != null).map(p => [p.id, p.pair_no as number]))
  const seed: Record<string, number> = Object.fromEntries(pairViews(players).map((p, i) => [String(p.no), i + 1]))
  const results: Result[] = matches
    .filter(m => isDone(m) && (group == null ? stageOf(m) === 'round' : stageOf(m) === 'group' && m.group_label === group))
    .map(m => ({ a: String(byNo.get(m.team1_player1_id)), b: String(byNo.get(m.team2_player1_id)), sa: m.team1_score ?? 0, sb: m.team2_score ?? 0 }))
  const names = new Map(pairs.map(p => [String(p.no), p.name]))
  return standings(pairs.map(p => String(p.no)), results, seed).map((s, i) => ({ ...s, name: names.get(s.id) ?? 'Pair', no: Number(s.id), qualifies: advance > 0 && i < advance }))
}

export type BracketMatch = { id: string; k: number; team1: string; team2: string; score1: number | null; score2: number | null; winner: 1 | 2 | null; court: string; done: boolean; third: boolean }
export type BracketRound = { round: number; label: string; matches: BracketMatch[] }

// The knockout rounds, in order, with the third-place match kept after the final.
export function bracketRounds(matches: VMatch[], players: VPlayer[]): BracketRound[] {
  const rounds = new Map<number, BracketRound>()
  for (const m of matches.filter(x => stageOf(x) === 'ko' || stageOf(x) === 'third_place').sort((a, b) => a.round_number - b.round_number || (a.match_number ?? 0) - (b.match_number ?? 0))) {
    const t = matchTeams(m, players, true)
    const winner = isDone(m) && m.team1_score != null && m.team2_score != null && m.team1_score !== m.team2_score ? (m.team1_score > m.team2_score ? 1 : 2) : null
    const r = rounds.get(m.round_number) ?? { round: m.round_number, label: stageOf(m) === 'ko' ? m.label ?? `Round ${m.round_number}` : 'Final', matches: [] }
    if (stageOf(m) === 'ko') r.label = m.label ?? r.label
    r.matches.push({ id: m.id, k: m.match_number ?? 0, team1: t.team1, team2: t.team2, score1: m.team1_score, score2: m.team2_score, winner, court: m.court_id, done: isDone(m), third: stageOf(m) === 'third_place' })
    rounds.set(m.round_number, r)
  }
  return Array.from(rounds.values())
}

// Who won the knockout, once the final is scored.
export function champion(matches: VMatch[], players: VPlayer[]): { name: string; runnerUp: string } | null {
  const ko = matches.filter(m => stageOf(m) === 'ko')
  if (ko.length === 0) return null
  const last = Math.max(...ko.map(m => m.round_number))
  const final = ko.filter(m => m.round_number === last)
  if (final.length !== 1 || !isDone(final[0]) || final[0].team1_score === final[0].team2_score) return null
  const t = matchTeams(final[0], players, true)
  return (final[0].team1_score ?? 0) > (final[0].team2_score ?? 0) ? { name: t.team1, runnerUp: t.team2 } : { name: t.team2, runnerUp: t.team1 }
}

// ------------------------------------------------------------------ progress and next step

export function progressLabel(t: VTournament, matches: VMatch[]): string {
  if (t.status === 'completed') return 'Finished'
  if (t.status === 'draft' || matches.length === 0) return 'Not started'
  if (isRotationFormat(t.format)) return `Round ${t.current_round} of ${t.total_rounds}`
  if (t.format === 'fixed_round_robin') { const left = matches.filter(m => !isDone(m)).length; return `${matches.length - left} of ${matches.length} matches played` }
  const group = matches.filter(m => stageOf(m) === 'group'), ko = matches.filter(m => stageOf(m) !== 'group' && stageOf(m) !== 'round')
  if (t.format === 'groups_knockout' && ko.length === 0) return `Group stage: ${group.filter(isDone).length} of ${group.length} played`
  const latest = ko.length ? ko.reduce((a, b) => (b.round_number > a.round_number ? b : a)) : null
  return latest?.label ?? 'Knockout'
}

export type NextStep =
  | { kind: 'none'; hint: string }
  | { kind: 'pairs'; hint: string }
  | { kind: 'generate'; label: string; hint: string }

// What the club should do next, in plain words.
export function nextStep(t: VTournament, players: VPlayer[], matches: VMatch[]): NextStep {
  if (t.status === 'completed') return { kind: 'none', hint: 'This tournament is finished.' }
  const courts = (t.court_ids ?? []).length
  if (courts === 0) return { kind: 'none', hint: 'Pick at least one court.' }
  const latest = matches.filter(m => m.round_number === t.current_round)
  const roundDone = latest.length > 0 && latest.every(isDone)

  if (isRotationFormat(t.format)) {
    if (players.length < 4) return { kind: 'none', hint: 'Add at least 4 players.' }
    if (t.current_round >= t.total_rounds && roundDone) return { kind: 'none', hint: 'All the rounds have been played.' }
    if (t.current_round === 0) return { kind: 'generate', label: 'Generate round 1', hint: `${players.length} players, ${t.total_rounds} rounds.` }
    if (!roundDone) return { kind: 'none', hint: `Score every match in round ${t.current_round} to continue.` }
    return { kind: 'generate', label: `Generate round ${t.current_round + 1}`, hint: 'Partners are chosen so nobody repeats if they can help it.' }
  }

  if (isPairFormat(t.format)) {
    const pairs = pairViews(players)
    if (matches.length === 0) {
      if (players.length % 2 === 1) return { kind: 'pairs', hint: 'You have an odd number of players, so one has no partner. Add or remove one.' }
      if (unpaired(players).length > 0 || pairs.length === 0) return { kind: 'pairs', hint: 'Make the pairs first.' }
      const label = t.format === 'fixed_round_robin' ? 'Make the draw' : t.format === 'single_elim' ? 'Start the bracket' : 'Draw the groups'
      return { kind: 'generate', label, hint: `${pairs.length} pairs.` }
    }
    if (t.format === 'groups_knockout') {
      const group = matches.filter(m => stageOf(m) === 'group'), ko = matches.filter(m => stageOf(m) !== 'group')
      if (ko.length === 0) {
        if (group.every(isDone)) { const adv = normalizeSettings(t.format, t.settings).advance ?? 2; return { kind: 'generate', label: 'Start the knockout', hint: `The top ${adv === 1 ? 'pair' : adv + ' pairs'} from each group go through.` } }
        return { kind: 'none', hint: 'Score the group matches to unlock the knockout.' }
      }
    }
    if (t.format === 'single_elim' || t.format === 'groups_knockout') {
      if (roundDone) return { kind: 'generate', label: 'Make the next round', hint: 'The next round normally appears by itself.' }
      return { kind: 'none', hint: 'The next round appears when every match in this one is scored.' }
    }
    return { kind: 'none', hint: `${matches.filter(m => !isDone(m)).length} matches to play.` }
  }
  return { kind: 'none', hint: '' }
}
