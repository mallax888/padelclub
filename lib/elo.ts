// Elo-style rating adjustment on the app's existing 1.0-7.0 skill_rating
// scale (same scale as SKILL_LEVELS). Playing regularly and winning/losing
// against real opponents is what should move your rating, not a one-time
// self-declared label -- this is what actually corrects an over- or
// under-ranked player over a handful of matches instead of never.

// How much a full "tier" of rating gap (e.g. Beginner 1.0 vs Intermediate
// 3.0) skews the expected outcome. Smaller D = rating gaps matter more.
const RATING_DIVISOR = 2.0

// Max rating change from a single match. Big enough that a handful of
// upsets visibly corrects a wrong starting rating within ~10-15 matches;
// small enough that one fluke result can't swing someone a full tier.
const K_FACTOR = 0.3

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / RATING_DIVISOR))
}

export function average(ratings: number[]): number {
  return ratings.reduce((sum, r) => sum + r, 0) / ratings.length
}

// Returns the rating delta to apply to every player on a team, given that
// team's (or solo player's) average rating, the opposing side's average
// rating, and whether this team won. Both teams' deltas are computed from
// the same match (winner's delta is positive, loser's is the mirror
// negative) since expectedScore(A,B) + expectedScore(B,A) == 1.
export function ratingDelta(teamRating: number, opponentRating: number, won: boolean): number {
  const expected = expectedScore(teamRating, opponentRating)
  const actual = won ? 1 : 0
  return K_FACTOR * (actual - expected)
}
