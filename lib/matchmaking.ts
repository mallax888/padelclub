// The rules of skill matchmaking, as pure functions (client-safe, no server
// imports): how a player's level compares to a game, whether a game is evenly
// matched, how to split four players into fair teams, which games to suggest, and
// a sensible level range when starting one. Used by Open play and by the booking
// flow, so they agree. Ratings are the app's 0.5-7.0 skill_rating (lib/skill-levels).

// Recorded matches needed before a rating counts as settled.
export const RELIABLE_MATCHES = 10
// A game this much (or more) outside your level gets a heads-up before you join.
export const WARN_GAP = 0.5
// Spread between the strongest and weakest player: up to EVEN_SPREAD is an even
// game, up to MIXED_SPREAD a mixed one, beyond that uneven.
export const EVEN_SPREAD = 1.0
export const MIXED_SPREAD = 2.0
export const MIN_RATING = 0.5
export const MAX_RATING = 7.0

export type Fit = 'fits' | 'above' | 'below' | null
export type Quality = 'even' | 'mixed' | 'uneven'

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
const round1 = (n: number) => Math.round(n * 10) / 10
const roundHalf = (n: number) => Math.round(n * 2) / 2

export const levelNumber = (rating: number): string => rating.toFixed(1)

// 'New' until they have played enough recorded matches to trust the number.
export const reliabilityOf = (matches: number | null | undefined): 'reliable' | 'new' | null =>
  matches === null || matches === undefined ? null : matches >= RELIABLE_MATCHES ? 'reliable' : 'new'

// Where this player sits against a game's level range. Null when they have no
// rating yet, so no verdict is shown rather than a wrong one. "above" means the
// game is above the player.
export function levelFit(rating: number | null | undefined, min: number, max: number): Fit {
  if (!finite(rating)) return null
  if (rating < min) return 'above'
  if (rating > max) return 'below'
  return 'fits'
}

// How far outside a game's range this player is (0 when inside it).
export const rangeGap = (rating: number, min: number, max: number): number => (rating < min ? min - rating : rating > max ? rating - max : 0)

export type JoinWarning = { direction: 'above' | 'below'; gap: number }
// A heads-up before joining a game well outside your level. Never a block.
export function joinWarning(rating: number | null | undefined, min: number, max: number): JoinWarning | null {
  if (!finite(rating)) return null
  const gap = rangeGap(rating, min, max)
  if (gap < WARN_GAP) return null
  return { direction: rating < min ? 'above' : 'below', gap: round1(gap) }
}

// ----------------------------------------------------------------- evenness

export const spreadOf = (ratings: number[]): number | null => {
  const r = ratings.filter(finite)
  return r.length < 2 ? null : round1(Math.max(...r) - Math.min(...r))
}

// How even a game is, from the players' ratings. Needs at least two rated players.
export function qualityOf(ratings: number[]): Quality | null {
  const s = spreadOf(ratings)
  if (s === null) return null
  return s <= EVEN_SPREAD ? 'even' : s <= MIXED_SPREAD ? 'mixed' : 'uneven'
}
export const QUALITY_LABEL: Record<Quality, string> = { even: 'Evenly matched', mixed: 'A bit mixed', uneven: 'Uneven' }

export type TeamPlayer = { id: string; name: string; rating: number }
export type TeamSplit = { a: TeamPlayer[]; b: TeamPlayer[]; avgA: number; avgB: number; diff: number }

// The fairest way to split four players into two pairs: the pairing whose team
// averages are closest. Null unless there are exactly four rated players.
export function suggestTeams(players: TeamPlayer[]): TeamSplit | null {
  if (players.length !== 4 || !players.every(p => finite(p.rating))) return null
  const [p0, p1, p2, p3] = players
  const pairings: [TeamPlayer[], TeamPlayer[]][] = [[[p0, p1], [p2, p3]], [[p0, p2], [p1, p3]], [[p0, p3], [p1, p2]]]
  let best: TeamSplit | null = null
  for (const [a, b] of pairings) {
    const avgA = (a[0].rating + a[1].rating) / 2, avgB = (b[0].rating + b[1].rating) / 2
    const diff = Math.abs(avgA - avgB)
    if (best === null || diff < best.diff - 1e-9) best = { a, b, avgA: Math.round(avgA * 100) / 100, avgB: Math.round(avgB * 100) / 100, diff: Math.round(diff * 100) / 100 }
  }
  return best
}

// ------------------------------------------------------------------ for you

export type GameLite = {
  id: string
  date: string
  start_time: string
  venue_slug: string
  skill_min: number
  skill_max: number
  spotsLeft: number
  ratings: number[] // ratings of the players already in
  mine: boolean // already in it, or organising it, or has asked to join
}

// The games to put at the top for this player: ones that fit, have room, that they
// aren't already in. Evenly matched first, then their home club, then soonest.
export function rankForYou<G extends GameLite>(games: G[], viewerRating: number | null | undefined, homeVenueSlug: string | null, limit = 3): G[] {
  if (!finite(viewerRating)) return []
  const scored = games
    .filter(g => !g.mine && g.spotsLeft > 0 && levelFit(viewerRating, g.skill_min, g.skill_max) === 'fits')
    .map(g => {
      const q = qualityOf([...g.ratings, viewerRating])
      const score = (q === 'even' ? 2 : q === 'mixed' ? 1 : 0) + (homeVenueSlug && g.venue_slug === homeVenueSlug ? 1.5 : 0)
      return { g, score }
    })
  scored.sort((x, y) => y.score - x.score || (x.g.date + x.g.start_time).localeCompare(y.g.date + y.g.start_time))
  return scored.slice(0, limit).map(s => s.g)
}

// ---------------------------------------------------------------- starting one

// The level range suggested when you open a game: a step either side of you,
// to the nearest half. No rating means no suggestion: open to everyone.
export function defaultRange(rating: number | null | undefined): { min: number; max: number } {
  if (!finite(rating)) return { min: MIN_RATING, max: MAX_RATING }
  return { min: Math.max(MIN_RATING, roundHalf(rating - 1)), max: Math.min(MAX_RATING, roundHalf(rating + 1)) }
}

// A range clamped to the scale and kept at least half a step wide.
export function clampRange(min: number, max: number): { min: number; max: number } {
  let lo = Math.min(Math.max(roundHalf(min), MIN_RATING), MAX_RATING)
  let hi = Math.min(Math.max(roundHalf(max), MIN_RATING), MAX_RATING)
  if (hi < lo) [lo, hi] = [hi, lo]
  if (hi - lo < 0.5) { if (hi + 0.5 <= MAX_RATING) hi = lo + 0.5; else lo = hi - 0.5 }
  return { min: lo, max: hi }
}

// Is this the whole scale? Stored as 0-7 like the "all levels" option always was.
export const isAllLevels = (min: number, max: number): boolean => min <= MIN_RATING && max >= MAX_RATING
