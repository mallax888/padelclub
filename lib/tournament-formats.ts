// What each tournament format is, how long it takes, and which one to suggest.
// Pure functions, no database: used by the new-tournament screen and by the server.

export type FormatId =
  | 'americano' | 'mexicano' | 'team_americano' | 'king_of_court'
  | 'fixed_round_robin' | 'single_elim' | 'double_elim' | 'groups_knockout' | 'swiss'

export type FormatGroup = 'social' | 'comp'

export type FormatInfo = {
  id: FormatId
  name: string
  group: FormatGroup
  ready: boolean // false = shown as "coming soon", cannot be created yet
  unit: 'players' | 'pairs'
  blurb: string
  need: [number, number] // sensible range, in players or pairs (see unit)
  hardMin: number // fewest players (or pairs) the format can run with
}

export const FORMATS: FormatInfo[] = [
  { id: 'americano', name: 'Americano', group: 'social', ready: true, unit: 'players', blurb: 'New partner every round, so everyone plays with everyone.', need: [8, 32], hardMin: 4 },
  { id: 'mexicano', name: 'Mexicano', group: 'social', ready: true, unit: 'players', blurb: 'Partners and opponents are set by the standings, so matches get closer each round.', need: [8, 32], hardMin: 4 },
  { id: 'team_americano', name: 'Team Americano', group: 'social', ready: false, unit: 'players', blurb: 'Two or more teams; partners rotate within the team and points count for the team.', need: [12, 48], hardMin: 8 },
  { id: 'fixed_round_robin', name: 'Fixed-pair round robin', group: 'social', ready: true, unit: 'pairs', blurb: 'Keep your partner and play every other pair once.', need: [4, 10], hardMin: 3 },
  { id: 'king_of_court', name: 'King of the Court (Pozo)', group: 'social', ready: false, unit: 'players', blurb: 'Winners move up a court, losers move down. The top court is the prize. Great for mixed levels.', need: [8, 32], hardMin: 8 },
  { id: 'single_elim', name: 'Single elimination', group: 'comp', ready: true, unit: 'pairs', blurb: 'The classic bracket. Lose and you are out.', need: [4, 32], hardMin: 2 },
  { id: 'double_elim', name: 'Double elimination', group: 'comp', ready: false, unit: 'pairs', blurb: 'Out after two losses, so everyone plays at least twice. Fairer but longer.', need: [4, 16], hardMin: 4 },
  { id: 'groups_knockout', name: 'Groups, then knockout', group: 'comp', ready: true, unit: 'pairs', blurb: 'Pools of 3-5 pairs, then the best go through to a bracket. The one most clubs expect for a proper day.', need: [6, 32], hardMin: 4 },
  { id: 'swiss', name: 'Swiss', group: 'comp', ready: false, unit: 'pairs', blurb: 'Each round you meet pairs with a similar record. No knockouts, fair matches for big fields.', need: [8, 40], hardMin: 6 },
]

export const GROUP_LABEL: Record<FormatGroup, string> = { social: 'Social days', comp: 'Competitive days' }

export const formatInfo = (id: string): FormatInfo | undefined => FORMATS.find(f => f.id === id)
export const formatName = (id: string): string => formatInfo(id)?.name ?? id
export const isPairFormat = (id: string): boolean => formatInfo(id)?.unit === 'pairs'
// Americano and Mexicano make fresh pairings every round from the whole roster
export const isRotationFormat = (id: string): boolean => id === 'americano' || id === 'mexicano'
export const isKnockoutFormat = (id: string): boolean => id === 'single_elim' || id === 'groups_knockout'

// ------------------------------------------------------------------ settings

export type Settings = {
  groupSize?: 3 | 4 | 5
  advance?: 1 | 2
  groupWinnersApart?: boolean
  thirdPlace?: boolean
  matchMinutes?: number // how long one match is expected to take (planning only)
  roundMinutes?: number // rotation formats
}

const pick = <T,>(v: unknown, allowed: T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback)
const clampInt = (v: unknown, lo: number, hi: number, fallback: number): number => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : fallback
}

// Only keeps the choices that format understands, clamped to sensible values.
export function normalizeSettings(format: string, raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const out: Settings = {}
  if (isRotationFormat(format)) out.roundMinutes = clampInt(r.roundMinutes, 5, 60, 15)
  else out.matchMinutes = clampInt(r.matchMinutes, 10, 120, 30)
  if (format === 'single_elim' || format === 'groups_knockout') out.thirdPlace = r.thirdPlace === true
  if (format === 'groups_knockout') {
    out.groupSize = pick<3 | 4 | 5>(Number(r.groupSize) as 3 | 4 | 5, [3, 4, 5], 4)
    out.advance = pick<1 | 2>(Number(r.advance) as 1 | 2, [1, 2], 2)
    out.groupWinnersApart = r.groupWinnersApart !== false
  }
  return out
}

// ------------------------------------------------------------------ planning

export type Plan = { players: number; courts: number; minutes: number; matchMinutes?: number; roundMinutes?: number }
export type Estimate = {
  minutes: number // total playing time
  summary: string
  each: string // how much each entry plays
  note: string
  fits: boolean
  entries: number // pairs or players, whichever the format uses
  inRange: boolean
}

const log2c = (x: number) => Math.ceil(Math.log2(Math.max(2, x)))
// time slots a knockout of `pairs` entries needs on `courts` courts, one round after another
function bracketSlots(pairs: number, courts: number): number {
  let slots = 0, left = pairs
  while (left > 1) { const m = Math.floor(left / 2); slots += Math.ceil(m / courts); left = Math.ceil(left / 2) }
  return slots
}

export function groupsFor(pairs: number, groupSize: number): number { return Math.max(1, Math.round(pairs / groupSize)) }

export function estimate(format: string, plan: Plan, settings: Settings = {}): Estimate {
  const info = formatInfo(format)
  const { players, courts, minutes } = plan
  const pairs = Math.floor(players / 2)
  const entries = info?.unit === 'pairs' ? pairs : players
  const mLen = plan.matchMinutes ?? settings.matchMinutes ?? 30
  const rLen = plan.roundMinutes ?? settings.roundMinutes ?? 15
  let total = 0, summary = '', each = '', note = ''
  const C = Math.max(1, courts)
  switch (format) {
    case 'americano': case 'mexicano': {
      const full = Math.max(1, players - 1), fit = Math.max(1, Math.floor(minutes / rLen)), r = Math.min(full, fit)
      total = r * rLen; summary = `${r} rounds of ${rLen} min`; each = `${r} matches each`
      const sit = players - Math.min(players - (players % 4), 4 * C)
      if (sit > 0) note = `${sit} player${sit === 1 ? '' : 's'} sit out each round (${players > 4 * C ? 'the courts are the limit' : 'players come in fours'})`
      if (r < full) note = (note ? note + '. ' : '') + `A full rotation would be ${full} rounds`
      break
    }
    case 'fixed_round_robin': {
      const m = pairs * (pairs - 1) / 2, slots = Math.ceil(m / C)
      total = slots * mLen; summary = `${m} matches in ${slots} slots of ${mLen} min`; each = `${Math.max(0, pairs - 1)} matches per pair`
      if (pairs > 10) note = 'A lot of matches for one day; groups would suit better'
      break
    }
    case 'single_elim': {
      const slots = bracketSlots(pairs, C)
      total = slots * mLen; summary = `${Math.max(0, pairs - 1)} matches, ${log2c(pairs)} rounds`; each = `1 to ${log2c(pairs)} matches per pair`
      note = 'Half the field plays only once'
      break
    }
    case 'groups_knockout': {
      const g = settings.groupSize ?? (pairs <= 8 ? 4 : 4), adv = settings.advance ?? 2
      const G = groupsFor(pairs, g), gm = Math.round(pairs * (pairs / G - 1) / 2), q = Math.min(adv * G, pairs)
      const slots = Math.ceil(gm / C) + bracketSlots(q, C)
      total = slots * mLen; summary = `${G} group${G === 1 ? '' : 's'} of about ${Math.round(pairs / G)}, then a ${q}-pair knockout (${gm + q - 1} matches)`
      each = `${Math.round(pairs / G) - 1} group matches, up to ${log2c(q)} more`
      break
    }
    default: { // formats not built yet: a rough figure so the picker can still compare them
      const slots = Math.ceil(Math.max(1, pairs) * log2c(pairs) / 2 / C)
      total = slots * mLen; summary = 'Coming soon'; each = ''
    }
  }
  const [lo, hi] = info?.need ?? [4, 40]
  return { minutes: total, summary, each, note, fits: total <= minutes, entries, inRange: entries >= lo && entries <= hi }
}

// ------------------------------------------------------------------ the helper

export type Goal = 'social' | 'lots' | 'winner' | 'weeks'
export type Ask = Plan & { mixed: boolean; goal: Goal }
export type Recommendation = { id: FormatId | 'ladder'; name: string; score: number; reasons: string[]; href?: string }

const GOAL_BONUS: Record<Goal, Partial<Record<FormatId, number>>> = {
  social: { americano: 2, fixed_round_robin: 1 },
  lots: { americano: 2, mexicano: 2, fixed_round_robin: 2, single_elim: -2, groups_knockout: 1 },
  winner: { groups_knockout: 3, single_elim: 1, mexicano: 1, fixed_round_robin: 2 },
  weeks: {},
}
const GOAL_REASON: Record<Goal, string> = {
  social: 'a relaxed, social day', lots: 'everyone plays lots of matches', winner: 'a fair, proper winner', weeks: 'keeps people coming back over weeks',
}

const joinReasons = (r: string[]) => (r.length ? 'Good because it ' + r.join(', ').replace(/, ([^,]*)$/, ' and $1') + '.' : '')
export { joinReasons }

// Suggests up to three formats that fit the day. Only formats that can be created now are suggested.
export function recommend(ask: Ask): Recommendation[] {
  if (ask.goal === 'weeks') {
    return [{ id: 'ladder', name: 'Ladder', score: 10, reasons: ['runs all season', 'players challenge each other when it suits them'], href: '/ladders' }]
  }
  const out: Recommendation[] = []
  for (const f of FORMATS.filter(x => x.ready)) {
    const e = estimate(f.id, ask, normalizeSettings(f.id, {}))
    const reasons: string[] = []
    let s = 0
    if (e.fits) { s += 2; reasons.push(`fits your day (about ${Math.round(e.minutes)} min)`) } else { s -= e.minutes / ask.minutes > 1.25 ? 4 : 2 }
    s += e.inRange ? 1 : -2
    if (ask.mixed) {
      if (f.id === 'americano') { s += 2; reasons.push('works well with mixed levels') }
      if (f.id === 'single_elim') s -= 1
    } else if (f.id === 'mexicano' || f.id === 'groups_knockout') { s += 1; reasons.push('suits players of a similar level') }
    const bonus = GOAL_BONUS[ask.goal][f.id] ?? 0
    s += bonus
    if (bonus >= 2) reasons.push(GOAL_REASON[ask.goal])
    out.push({ id: f.id, name: f.name, score: s, reasons: Array.from(new Set(reasons)).slice(0, 3) })
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 3)
}

// ------------------------------------------------------------------ checks

// Hard problems that stop a tournament starting, in plain words. Empty = fine.
export function startProblems(format: string, o: { players: number; pairs: number; courts: number; odd?: boolean; unpaired?: boolean }): string[] {
  const info = formatInfo(format)
  if (!info) return ['That format is not available.']
  if (!info.ready) return [`${info.name} is coming soon.`]
  const out: string[] = []
  if (o.courts < 1) out.push('Pick at least one court.')
  if (info.unit === 'players') {
    if (o.players < info.hardMin) out.push(`${info.name} needs at least ${info.hardMin} players.`)
  } else {
    if (o.players % 2 === 1) out.push('You have an odd number of players, so one has no partner. Add or remove one.')
    else if (o.unpaired) out.push('Make the pairs first.')
    else if (o.pairs < info.hardMin) out.push(`${info.name} needs at least ${info.hardMin} pairs.`)
  }
  return out
}

export const hm = (m: number): string => {
  const h = Math.floor(m / 60), r = Math.round(m % 60)
  return h ? `${h} h ${String(r).padStart(2, '0')} min` : `${r} min`
}
