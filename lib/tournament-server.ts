// Server side of tournaments (see lib/tournament-engine.ts for the rules and
// supabase/migrations/032_tournament_formats.sql for the tables). Everything that changes
// a tournament goes through here, using the service-role client AFTER the caller has been
// identified and checked against the tournament's club, so a front-desk person can only
// run tournaments at the clubs they cover and nobody can create a half-built bracket.
import type { SupabaseClient } from '@supabase/supabase-js'
import { VENUES } from '@/lib/venues'
import { covers, type Reach } from '@/lib/team'
import { pairMexicanoRound } from '@/lib/tournament'
import {
  addToHistory, americanoRound, assignCourts, buildGroups, emptyHistory, groupLabel, makePairs, planKnockout, roundRobinRounds, seededRng,
  standings, type KoMatch, type Result, type Standing,
} from '@/lib/tournament-engine'
import { formatInfo, isPairFormat, isRotationFormat, normalizeSettings, startProblems, type Settings } from '@/lib/tournament-formats'

type Db = SupabaseClient<any>
export type Caller = { id: string; role: string; reach: Reach }
export type Fail = { error: string; status: number }
const fail = (error: string, status = 400): Fail => ({ error, status })

export type TRow = {
  id: string; name: string; venue_slug: string; date: string; format: string; status: string; court_ids: string[]
  points_to_win: number; total_rounds: number; current_round: number; settings?: Settings | null
}
export type PRow = {
  id: string; tournament_id: string; player_id: string | null; guest_name: string | null; total_points: number
  pair_no?: number | null; group_label?: string | null; seed?: number | null
}
export type MRow = {
  id: string; tournament_id: string; round_number: number; court_id: string; status: string
  team1_player1_id: string; team1_player2_id: string; team2_player1_id: string; team2_player2_id: string
  team1_score: number | null; team2_score: number | null
  stage?: string | null; label?: string | null; match_number?: number | null; group_label?: string | null; wave?: number | null
}

const missingColumn = (error: any): boolean =>
  !!error && (error.code === '42703' || error.code === 'PGRST204' || /column .* does not exist|could not find .* column/i.test(String(error.message ?? '')))
const duplicate = (error: any): boolean => !!error && (error.code === '23505' || /duplicate key/i.test(String(error.message ?? '')))

// Has the formats database change (032) been run?
export async function formatsReady(db: Db): Promise<boolean> {
  const { error } = await (db as any).from('tournaments').select('settings').limit(1)
  return !missingColumn(error)
}

export const isStaff = (c: Caller): boolean => c.role === 'staff' || c.role === 'admin'
export const canManage = (c: Caller, t: { venue_slug: string }): boolean => isStaff(c) && covers(c.reach, { kind: 'club', venueSlug: t.venue_slug })
const stageOf = (m: MRow): string => m.stage ?? 'round'
const done = (m: MRow): boolean => m.status === 'completed'

export async function loadAll(db: Db, id: string): Promise<{ t: TRow; players: PRow[]; matches: MRow[] } | null> {
  const { data: t } = await (db as any).from('tournaments').select('*').eq('id', id).maybeSingle()
  if (!t) return null
  const { data: players } = await (db as any).from('tournament_players').select('*').eq('tournament_id', id)
  const { data: matches } = await (db as any).from('tournament_matches').select('*').eq('tournament_id', id).order('round_number', { ascending: true })
  return { t, players: players ?? [], matches: matches ?? [] }
}

// ------------------------------------------------------------------ create

export type CreateInput = {
  name: string; format: string; venueSlug: string; date: string; courtIds: string[]
  pointsToWin?: number; totalRounds?: number; playerIds?: string[]; guestNames?: string[]; settings?: unknown
}

export async function createTournament(db: Db, caller: Caller, input: CreateInput): Promise<{ ok: true; id: string } | Fail> {
  if (!isStaff(caller)) return fail('Only club staff can set up a tournament.', 403)
  const name = (input.name ?? '').trim()
  if (!name) return fail('Give the tournament a name.')
  if (name.length > 80) return fail('That name is too long.')
  const venue = VENUES.find(v => v.slug === input.venueSlug)
  if (!venue) return fail('Pick a club.')
  if (!covers(caller.reach, { kind: 'club', venueSlug: venue.slug })) return fail('That club is outside the clubs you look after.', 403)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date ?? '')) return fail('Pick a date.')
  const info = formatInfo(input.format)
  if (!info) return fail('Pick a format.')
  if (!info.ready) return fail(`${info.name} is coming soon.`)
  const courtIds = Array.from(new Set(input.courtIds ?? []))
  if (courtIds.length === 0) return fail('Pick at least one court.')
  if (!courtIds.every(c => venue.courts.some(vc => vc.id === c))) return fail('One of those courts is not at this club.')
  const guestNames = Array.from(new Set((input.guestNames ?? []).map(g => String(g).trim()).filter(Boolean))).slice(0, 80)
  if (guestNames.some(g => g.length > 40)) return fail('Guest names must be 40 letters or fewer.')
  const playerIds = Array.from(new Set(input.playerIds ?? []))

  const modern = info.id !== 'americano' && info.id !== 'mexicano'
  const ready = await formatsReady(db)
  if (modern && !ready) return fail('This format needs a one-off update to the database first. Ask whoever looks after PadelClub to run the latest setup step.', 503)

  const row: Record<string, unknown> = {
    name, format: info.id, venue_slug: venue.slug, date: input.date, court_ids: courtIds, organizer_id: caller.id,
    points_to_win: Math.min(99, Math.max(1, Math.round(Number(input.pointsToWin) || 21))),
    total_rounds: Math.min(40, Math.max(1, Math.round(Number(input.totalRounds) || 8))),
  }
  if (ready) row.settings = normalizeSettings(info.id, input.settings)
  const { data: t, error } = await (db as any).from('tournaments').insert(row).select('id').single()
  if (error || !t) return fail('Could not create the tournament. Please try again.', 500)

  const roster = [...playerIds.map(p => ({ tournament_id: t.id, player_id: p })), ...guestNames.map(g => ({ tournament_id: t.id, guest_name: g }))]
  if (roster.length > 0) {
    const { error: e2 } = await (db as any).from('tournament_players').insert(roster)
    if (e2) return fail('The tournament was created, but adding players failed. Add them from the tournament page.', 500)
  }
  return { ok: true, id: t.id }
}

// ------------------------------------------------------------------ roster

export async function changeRoster(
  db: Db, caller: Caller,
  input: { tournamentId: string; action: 'add' | 'remove'; playerId?: string; guestName?: string; rowId?: string },
): Promise<{ ok: true } | Fail> {
  const all = await loadAll(db, input.tournamentId)
  if (!all) return fail('Tournament not found.', 404)
  const { t, players, matches } = all
  if (!canManage(caller, t)) return fail('You can only change tournaments at the clubs you look after.', 403)
  if (t.status === 'completed') return fail('This tournament is finished.', 409)
  // pair formats are fixed once play starts; Americano and Mexicano can take late arrivals
  if (!isRotationFormat(t.format) && t.status !== 'draft') return fail('Players cannot change once this format has started.', 409)

  if (input.action === 'add') {
    const guest = (input.guestName ?? '').trim()
    if (!input.playerId && !guest) return fail('Choose a player or type a guest name.')
    if (guest.length > 40) return fail('Guest names must be 40 letters or fewer.')
    if (input.playerId && players.some(p => p.player_id === input.playerId)) return fail('They are already in this tournament.', 409)
    const { error } = await (db as any).from('tournament_players').insert(input.playerId ? { tournament_id: t.id, player_id: input.playerId } : { tournament_id: t.id, guest_name: guest })
    if (error) return fail('Could not add them. Please try again.', 500)
  } else {
    const row = players.find(p => p.id === input.rowId)
    if (!row) return fail('That player is not in this tournament.', 404)
    const inMatch = matches.some(m => [m.team1_player1_id, m.team1_player2_id, m.team2_player1_id, m.team2_player2_id].includes(row.id))
    if (inMatch) return fail('They have already been drawn into matches, so they cannot be removed.', 409)
    const { error } = await (db as any).from('tournament_players').delete().eq('id', row.id)
    if (error) return fail('Could not remove them. Please try again.', 500)
  }
  // any change to the roster undoes the pairs, so nobody is left with a missing partner
  if (isPairFormat(t.format)) await clearPairRows(db, t.id)
  return { ok: true }
}

async function clearPairRows(db: Db, tournamentId: string) {
  await (db as any).from('tournament_players').update({ pair_no: null, seed: null, group_label: null, team_name: null }).eq('tournament_id', tournamentId)
}

// ------------------------------------------------------------------ pairs

export type PairsInput = { tournamentId: string; mode: 'random' | 'balanced' | 'manual' | 'clear'; pairs?: string[][] }

const nameOf = (p: PRow, profiles: Map<string, { nickname: string | null; full_name: string | null }>): string =>
  p.guest_name ?? profiles.get(p.player_id ?? '')?.nickname ?? profiles.get(p.player_id ?? '')?.full_name ?? 'Player'

export async function makeTournamentPairs(db: Db, caller: Caller, input: PairsInput): Promise<{ ok: true; pairs: string[][] } | Fail> {
  const all = await loadAll(db, input.tournamentId)
  if (!all) return fail('Tournament not found.', 404)
  const { t, players, matches } = all
  if (!canManage(caller, t)) return fail('You can only change tournaments at the clubs you look after.', 403)
  if (!isPairFormat(t.format)) return fail('This format does not use fixed pairs.')
  if (t.status !== 'draft' || matches.length > 0) return fail('The pairs are locked once play has started.', 409)
  if (input.mode === 'clear') { await clearPairRows(db, t.id); return { ok: true, pairs: [] } }
  if (players.length % 2 === 1) return fail('You have an odd number of players, so one has no partner. Add or remove one.')
  if (players.length < 4) return fail('Add at least 4 players first.')

  let pairs: string[][]
  if (input.mode === 'manual') {
    const given = input.pairs ?? []
    const flat = given.flat()
    if (!given.every(p => Array.isArray(p) && p.length === 2)) return fail('Each pair needs exactly two players.')
    if (new Set(flat).size !== flat.length || flat.length !== players.length || !flat.every(id => players.some(p => p.id === id))) return fail('Every player must be in exactly one pair.')
    pairs = given
  } else {
    const ids = players.map(p => p.player_id).filter(Boolean) as string[]
    const ratings = new Map<string, number | null>()
    if (ids.length > 0) {
      const { data } = await (db as any).from('profiles').select('id, skill_rating').in('id', ids)
      for (const r of data ?? []) ratings.set(r.id, typeof r.skill_rating === 'number' ? r.skill_rating : null)
    }
    const rng = seededRng(Math.floor(Math.random() * 2 ** 31))
    pairs = makePairs(players.map(p => ({ id: p.id, rating: p.player_id ? ratings.get(p.player_id) ?? null : null })), input.mode, rng)
    // strongest pair gets seed 1 (only matters for brackets and groups)
    const strength = (pr: string[]) => pr.reduce((s, id) => s + (ratings.get(players.find(p => p.id === id)?.player_id ?? '') ?? 0), 0)
    pairs = [...pairs].sort((a, b) => strength(b) - strength(a))
  }
  for (let i = 0; i < pairs.length; i++) {
    for (const id of pairs[i]) {
      const { error } = await (db as any).from('tournament_players').update({ pair_no: i + 1, seed: i + 1 }).eq('id', id)
      if (error) return fail('Could not save the pairs. Please try again.', 500)
    }
  }
  return { ok: true, pairs }
}

// ------------------------------------------------------------------ helpers for generation

type PairInfo = { no: number; rows: [string, string]; seed: number; group: string | null }

// Pairs as saved on the player rows; null if they have not all been made yet.
export function pairsOf(players: PRow[]): PairInfo[] | null {
  if (players.length === 0 || players.some(p => p.pair_no == null)) return null
  const byNo = new Map<number, PRow[]>()
  for (const p of players) byNo.set(p.pair_no as number, [...(byNo.get(p.pair_no as number) ?? []), p])
  const out: PairInfo[] = []
  for (const [no, rows] of Array.from(byNo)) {
    if (rows.length !== 2) return null
    out.push({ no, rows: [rows[0].id, rows[1].id], seed: rows[0].seed ?? no, group: rows[0].group_label ?? null })
  }
  return out.sort((a, b) => a.seed - b.seed || a.no - b.no)
}

const pairNoMap = (players: PRow[]): Map<string, number> => new Map(players.filter(p => p.pair_no != null).map(p => [p.id, p.pair_no as number]))
const sideOf = (m: MRow): 0 | 1 | 2 => (m.team1_score == null || m.team2_score == null || m.team1_score === m.team2_score ? 0 : m.team1_score > m.team2_score ? 1 : 2)

function matchRow(t: TRow, m: { round: number; court: string; wave: number; a: [string, string]; b: [string, string]; stage: string; label: string; number: number; group?: string | null }) {
  return {
    tournament_id: t.id, round_number: m.round, court_id: m.court, wave: m.wave, stage: m.stage, label: m.label, match_number: m.number, group_label: m.group ?? null,
    team1_player1_id: m.a[0], team1_player2_id: m.a[1], team2_player1_id: m.b[0], team2_player2_id: m.b[1],
  }
}

const NEW_MATCH_COLUMNS = ['wave', 'stage', 'label', 'match_number', 'group_label']

// Before the formats database change (032) has been run, only the original columns exist; Americano and
// Mexicano keep working on those, so the new columns are left out of what is saved.
async function insertMatches(db: Db, t: TRow, rows: any[]): Promise<null | Fail> {
  if (t.settings === undefined) rows = rows.map(r => Object.fromEntries(Object.entries(r).filter(([k]) => !NEW_MATCH_COLUMNS.includes(k))))
  const { error } = await (db as any).from('tournament_matches').insert(rows)
  if (duplicate(error)) return fail('That round has already been created.', 409)
  if (error) return fail('Could not create the matches. Please try again.', 500)
  return null
}

export type Generated = { ok: true; message: string; round?: number; finished?: boolean; champion?: string }

// ------------------------------------------------------------------ generate (no permission check: callers do that)

export async function generateNext(db: Db, tournamentId: string): Promise<Generated | Fail> {
  const all = await loadAll(db, tournamentId)
  if (!all) return fail('Tournament not found.', 404)
  const { t } = all
  if (t.status === 'completed') return fail('This tournament is finished.', 409)
  const info = formatInfo(t.format)
  if (!info?.ready) return fail('That format is not available yet.')
  if ((t.court_ids ?? []).length === 0) return fail('Pick at least one court.')
  if (isRotationFormat(t.format)) return rotationNext(db, all)
  if (t.format === 'fixed_round_robin') return roundRobinStart(db, all)
  if (t.format === 'single_elim') return singleElimNext(db, all)
  if (t.format === 'groups_knockout') return groupsNext(db, all)
  return fail('That format is not available yet.')
}

export async function generateForCaller(db: Db, caller: Caller, tournamentId: string): Promise<Generated | Fail> {
  const { data: t } = await (db as any).from('tournaments').select('venue_slug').eq('id', tournamentId).maybeSingle()
  if (!t) return fail('Tournament not found.', 404)
  if (!canManage(caller, t)) return fail('You can only run tournaments at the clubs you look after.', 403)
  return generateNext(db, tournamentId)
}

// ---- Americano / Mexicano

async function rotationNext(db: Db, all: { t: TRow; players: PRow[]; matches: MRow[] }): Promise<Generated | Fail> {
  const { t, players, matches } = all
  const problems = startProblems(t.format, { players: players.length, pairs: 0, courts: t.court_ids.length })
  if (problems.length) return fail(problems[0])
  const inRound = matches.filter(m => m.round_number === t.current_round)
  if (t.current_round > 0 && (inRound.length === 0 || !inRound.every(done))) return fail('Finish the current round first.', 409)
  if (t.current_round >= t.total_rounds) return fail('All the rounds have been played.', 409)
  const next = t.current_round + 1

  // who has played with and against whom, and who has already sat out
  const h = emptyHistory()
  for (let r = 1; r <= t.current_round; r++) {
    const ms = matches.filter(m => m.round_number === r)
    const playing = new Set<string>()
    for (const m of ms) {
      addToHistory(h, { team1: [m.team1_player1_id, m.team1_player2_id], team2: [m.team2_player1_id, m.team2_player2_id] }, [])
      ;[m.team1_player1_id, m.team1_player2_id, m.team2_player1_id, m.team2_player2_id].forEach(x => playing.add(x))
    }
    for (const p of players) if (!playing.has(p.id)) h.sat[p.id] = (h.sat[p.id] ?? 0) + 1
  }

  const rng = seededRng(Math.floor(Math.random() * 2 ** 31))
  let pairings: { team1: [string, string]; team2: [string, string] }[]
  let sitting: string[]
  if (t.format === 'americano') {
    const r = americanoRound(players.map(p => p.id), t.court_ids.length, h, rng)
    pairings = r.pairings; sitting = r.sittingOut
  } else {
    // Mexicano: those who have sat out most play first, then the standings set the foursomes
    const groups = Math.min(Math.floor(players.length / 4), t.court_ids.length)
    const order = [...players].sort((a, b) => (h.sat[b.id] ?? 0) - (h.sat[a.id] ?? 0) || b.total_points - a.total_points)
    const playing = order.slice(0, groups * 4)
    sitting = order.slice(groups * 4).map(p => p.id)
    pairings = pairMexicanoRound(playing.map(p => ({ id: p.id, totalPoints: p.total_points })), t.court_ids).pairings.map(p => ({ team1: p.team1, team2: p.team2 }))
  }
  if (pairings.length === 0) return fail('There are not enough players or courts to start a round.')

  const placed = assignCourts(pairings, t.court_ids)
  const rows = placed.map((p, i) => matchRow(t, { round: next, court: p.court_id, wave: p.wave, a: p.team1, b: p.team2, stage: 'round', label: `Round ${next}`, number: i }))
  const bad = await insertMatches(db, t, rows)
  if (bad) return bad
  await (db as any).from('tournaments').update({ current_round: next, status: 'in_progress' }).eq('id', t.id)
  return { ok: true, round: next, message: `Round ${next} is ready${sitting.length > 0 ? `. ${sitting.length} sitting out.` : '.'}` }
}

// ---- Fixed-pair round robin

async function roundRobinStart(db: Db, all: { t: TRow; players: PRow[]; matches: MRow[] }): Promise<Generated | Fail> {
  const { t, players, matches } = all
  if (matches.length > 0) return fail('This round robin has already started.', 409)
  const pairs = pairsOf(players)
  const problems = startProblems(t.format, { players: players.length, pairs: pairs?.length ?? 0, courts: t.court_ids.length, unpaired: !pairs })
  if (problems.length) return fail(problems[0])
  const byNo = new Map(pairs!.map(p => [String(p.no), p]))
  const rounds = roundRobinRounds(pairs!.map(p => String(p.no)))
  const rows: any[] = []
  rounds.forEach((round, r) => {
    const placed = assignCourts(round.map(([a, b]) => ({ a, b })), t.court_ids)
    placed.forEach((m, i) => rows.push(matchRow(t, { round: r + 1, court: m.court_id, wave: m.wave, a: byNo.get(m.a)!.rows, b: byNo.get(m.b)!.rows, stage: 'round', label: `Round ${r + 1}`, number: i })))
  })
  const bad = await insertMatches(db, t, rows)
  if (bad) return bad
  await (db as any).from('tournaments').update({ total_rounds: rounds.length, current_round: 1, status: 'in_progress' }).eq('id', t.id)
  return { ok: true, round: 1, message: `The draw is made: ${rounds.length} rounds, ${rows.length} matches.` }
}

// ---- Knockout (single elimination, and the knockout part of groups)

function playedMap(matches: MRow[], noOf: Map<string, number>, offset: number): Record<number, KoMatch[]> {
  const played: Record<number, KoMatch[]> = {}
  for (const m of matches) {
    const s = stageOf(m)
    if (s !== 'ko' && s !== 'third_place') continue
    const a = String(noOf.get(m.team1_player1_id)), b = String(noOf.get(m.team2_player1_id))
    const side = done(m) ? sideOf(m) : 0
    const r = m.round_number - offset
    played[r] = played[r] ?? []
    played[r].push({ k: m.match_number ?? 0, a, b, winner: side === 1 ? a : side === 2 ? b : null, loser: side === 1 ? b : side === 2 ? a : null, extra: s === 'third_place' ? 'third_place' : undefined })
  }
  return played
}

async function knockoutStep(
  db: Db, all: { t: TRow; players: PRow[]; matches: MRow[] }, pairs: PairInfo[], seeded: string[], offset: number, groupOf?: Record<string, string>,
): Promise<Generated | Fail> {
  const { t, players, matches } = all
  const byNo = new Map(pairs.map(p => [String(p.no), p]))
  const settings = normalizeSettings(t.format, t.settings)
  const plan = planKnockout(seeded, playedMap(matches, pairNoMap(players), offset), { thirdPlace: settings.thirdPlace, groupOf })
  if (plan.action === 'wait') return fail('Finish the current round first.', 409)
  if (plan.action === 'done') {
    await (db as any).from('tournaments').update({ status: 'completed' }).eq('id', t.id)
    return { ok: true, finished: true, champion: plan.champion, message: 'The tournament is finished.' }
  }
  const ordered = [...plan.matches].sort((a, b) => Number(!!a.extra) - Number(!!b.extra) || a.k - b.k)
  const placed = assignCourts(ordered, t.court_ids)
  const rows = placed.map(m => matchRow(t, {
    round: offset + plan.round, court: m.court_id, wave: m.wave, a: byNo.get(m.a)!.rows, b: byNo.get(m.b)!.rows,
    stage: m.extra ? 'third_place' : 'ko', label: m.extra ? 'Third place' : plan.label, number: m.k,
  }))
  const bad = await insertMatches(db, t, rows)
  if (bad) return bad
  const patch: Record<string, unknown> = { current_round: offset + plan.round, status: 'in_progress' }
  if (plan.round === 1) patch.total_rounds = offset + Math.ceil(Math.log2(Math.max(2, seeded.length)))
  await (db as any).from('tournaments').update(patch).eq('id', t.id)
  const byes = plan.byes.length
  return { ok: true, round: offset + plan.round, message: `${plan.label} is ready${byes > 0 ? `. ${byes} ${byes === 1 ? 'pair has' : 'pairs have'} a bye.` : '.'}` }
}

async function singleElimNext(db: Db, all: { t: TRow; players: PRow[]; matches: MRow[] }): Promise<Generated | Fail> {
  const { t, players, matches } = all
  const pairs = pairsOf(players)
  const problems = startProblems(t.format, { players: players.length, pairs: pairs?.length ?? 0, courts: t.court_ids.length, unpaired: !pairs })
  if (problems.length) return fail(problems[0])
  if (matches.length > 0) {
    const inRound = matches.filter(m => m.round_number === t.current_round)
    if (!inRound.every(done)) return fail('Finish the current round first.', 409)
  }
  return knockoutStep(db, all, pairs!, pairs!.map(p => String(p.no)), 0)
}

// ---- Groups, then knockout

type GroupTable = { label: string; rows: Standing[] }

export function groupTables(players: PRow[], matches: MRow[]): GroupTable[] {
  const pairs = pairsOf(players)
  if (!pairs) return []
  const noOf = pairNoMap(players)
  const labels = Array.from(new Set(pairs.map(p => p.group).filter(Boolean) as string[])).sort()
  const seed: Record<string, number> = Object.fromEntries(pairs.map((p, i) => [String(p.no), i + 1]))
  return labels.map(label => {
    const ids = pairs.filter(p => p.group === label).map(p => String(p.no))
    const results: Result[] = matches.filter(m => stageOf(m) === 'group' && m.group_label === label && done(m)).map(m => ({
      a: String(noOf.get(m.team1_player1_id)), b: String(noOf.get(m.team2_player1_id)), sa: m.team1_score ?? 0, sb: m.team2_score ?? 0,
    }))
    return { label, rows: standings(ids, results, seed) }
  })
}

// Who goes through, best first: everyone's group winner, then runners-up, and so on, and within each
// of those by points, difference and games. This becomes the knockout seeding.
export function qualifiers(tables: GroupTable[], advance: number): { seeded: string[]; groupOf: Record<string, string> } {
  const seeded: string[] = [], groupOf: Record<string, string> = {}
  for (let pos = 0; pos < advance; pos++) {
    const tier = tables.map(t => ({ label: t.label, s: t.rows[pos] })).filter(x => x.s)
    tier.sort((a, b) => b.s.points - a.s.points || b.s.diff - a.s.diff || b.s.gf - a.s.gf || a.label.localeCompare(b.label))
    for (const x of tier) { seeded.push(x.s.id); groupOf[x.s.id] = x.label }
  }
  return { seeded, groupOf }
}

async function groupsNext(db: Db, all: { t: TRow; players: PRow[]; matches: MRow[] }): Promise<Generated | Fail> {
  const { t, players, matches } = all
  const settings = normalizeSettings(t.format, t.settings)
  const pairs = pairsOf(players)
  const problems = startProblems(t.format, { players: players.length, pairs: pairs?.length ?? 0, courts: t.court_ids.length, unpaired: !pairs })
  if (problems.length) return fail(problems[0])

  const groupMatches = matches.filter(m => stageOf(m) === 'group')
  if (matches.length === 0) {
    const byNo = new Map(pairs!.map(p => [String(p.no), p]))
    const groups = buildGroups(pairs!.map(p => String(p.no)), settings.groupSize ?? 4)
    const perGroup = groups.map(g => roundRobinRounds(g))
    const roundCount = Math.max(...perGroup.map(r => r.length))
    const rows: any[] = []
    for (let r = 0; r < roundCount; r++) {
      const items: { a: string; b: string; g: string }[] = []
      perGroup.forEach((rounds, gi) => (rounds[r] ?? []).forEach(([a, b]) => items.push({ a, b, g: groupLabel(gi) })))
      assignCourts(items, t.court_ids).forEach((m, i) => rows.push(matchRow(t, {
        round: r + 1, court: m.court_id, wave: m.wave, a: byNo.get(m.a)!.rows, b: byNo.get(m.b)!.rows, stage: 'group', label: `Group ${m.g}`, number: i, group: m.g,
      })))
    }
    // remember who is in which group before the matches exist, so the tables can show everyone
    for (let gi = 0; gi < groups.length; gi++) {
      for (const no of groups[gi]) for (const id of byNo.get(no)!.rows) {
        const { error } = await (db as any).from('tournament_players').update({ group_label: groupLabel(gi) }).eq('id', id)
        if (error) return fail('Could not make the groups. Please try again.', 500)
      }
    }
    const bad = await insertMatches(db, t, rows)
    if (bad) return bad
    await (db as any).from('tournaments').update({ total_rounds: roundCount, current_round: 1, status: 'in_progress' }).eq('id', t.id)
    return { ok: true, round: 1, message: `The groups are drawn: ${groups.length} group${groups.length === 1 ? '' : 's'}, ${rows.length} matches.` }
  }

  if (!groupMatches.every(done)) return fail('Finish the group matches first.', 409)
  const groupRounds = Math.max(...groupMatches.map(m => m.round_number))
  const koMatches = matches.filter(m => stageOf(m) !== 'group')
  if (koMatches.length > 0) {
    const latest = Math.max(...koMatches.map(m => m.round_number))
    if (!koMatches.filter(m => m.round_number === latest).every(done)) return fail('Finish the current round first.', 409)
  }
  const tables = groupTables(players, matches)
  const q = qualifiers(tables, settings.advance ?? 2)
  if (q.seeded.length < 2) return fail('Not enough pairs go through to make a knockout. Choose to take the top two from each group.')
  return knockoutStep(db, all, pairs!, q.seeded, groupRounds, settings.groupWinnersApart === false ? undefined : q.groupOf)
}

// ------------------------------------------------------------------ scores

export async function recordScore(
  db: Db, caller: Caller, input: { matchId: string; team1Score: number; team2Score: number },
): Promise<{ ok: true; finished: boolean; message?: string } | Fail> {
  const { matchId, team1Score: s1, team2Score: s2 } = input
  if (!matchId || !Number.isInteger(s1) || !Number.isInteger(s2)) return fail('Enter both scores as whole numbers.')
  if (s1 < 0 || s2 < 0) return fail('Scores cannot be negative.')
  if (s1 > 999 || s2 > 999) return fail('That score looks too high.')

  const { data: match } = await (db as any).from('tournament_matches').select('*').eq('id', matchId).maybeSingle()
  if (!match) return fail('Match not found.', 404)
  if (match.status === 'completed') return fail('This match already has a score recorded.', 409)
  const all = await loadAll(db, match.tournament_id)
  if (!all) return fail('Tournament not found.', 404)
  const { t, players } = all
  if (t.status === 'completed') return fail('This tournament is finished.', 409)

  const rowIds = [match.team1_player1_id, match.team1_player2_id, match.team2_player1_id, match.team2_player2_id]
  const participant = players.some(p => rowIds.includes(p.id) && p.player_id === caller.id)
  if (!canManage(caller, t) && !participant) return fail('Only the players in this match, or the club team, can record its score.', 403)
  const knockout = stageOf(match) === 'ko' || stageOf(match) === 'third_place'
  if (knockout && s1 === s2) return fail('A knockout match needs a winner. Check the score.')

  const { data: saved, error } = await (db as any).from('tournament_matches')
    .update({ team1_score: s1, team2_score: s2, status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', matchId).eq('status', 'pending').select('id')
  if (error) return fail('Could not save the score. Please try again.', 500)
  if (!saved || saved.length === 0) return fail('This match already has a score recorded.', 409)

  const t1Won = s1 > s2, t2Won = s2 > s1
  const stats = [
    { id: match.team1_player1_id, points: s1, won: t1Won }, { id: match.team1_player2_id, points: s1, won: t1Won },
    { id: match.team2_player1_id, points: s2, won: t2Won }, { id: match.team2_player2_id, points: s2, won: t2Won },
  ]
  for (const u of stats) await (db as any).rpc('increment_tournament_player_stats', { p_tournament_player_id: u.id, p_points: u.points, p_won: u.won })

  const after = await afterScore(db, t.id)
  return { ok: true, finished: after.finished, message: after.message }
}

// After a score: finish the tournament if that was the last match, and move a knockout on by itself.
async function afterScore(db: Db, tournamentId: string): Promise<{ finished: boolean; message?: string }> {
  const all = await loadAll(db, tournamentId)
  if (!all || all.t.status === 'completed') return { finished: !!all }
  const { t, matches } = all
  const finish = async (message?: string) => { await (db as any).from('tournaments').update({ status: 'completed' }).eq('id', t.id); return { finished: true, message } }

  if (isRotationFormat(t.format)) {
    if (t.current_round >= t.total_rounds && matches.length > 0 && matches.every(done)) return finish('All rounds played')
    return { finished: false }
  }
  if (t.format === 'fixed_round_robin') {
    if (matches.length > 0 && matches.every(done)) return finish('Every pair has played every other pair')
    return { finished: false }
  }
  const koStarted = matches.some(m => stageOf(m) === 'ko' || stageOf(m) === 'third_place')
  if (t.format === 'single_elim' || (t.format === 'groups_knockout' && koStarted)) {
    const latest = matches.filter(m => m.round_number === t.current_round)
    if (latest.length > 0 && latest.every(done)) {
      const next = await generateNext(db, tournamentId)
      if ('ok' in next) return { finished: !!next.finished, message: next.message }
    }
  }
  return { finished: false }
}
