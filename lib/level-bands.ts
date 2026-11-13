// The named levels (Beginner ... Elite) as ranges of the 0.5-7.0 rating scale, and the rules
// for choosing who can join a game by tapping them: the quick choices ("Similar to me",
// "A bit wider", "Any level"), which levels a range covers, and what a tap does. Pure
// functions, so the picker's behaviour is tested without a browser.
import { SKILL_LEVELS, skillLevelForRating } from '@/lib/skill-levels'

const MIN = 0.5, MAX = 7.0

export type Band = { value: string; label: string; lo: number; hi: number }
// Each level runs from its own rating up to the next level's.
export const LEVEL_BANDS: Band[] = SKILL_LEVELS.map((l, i) => ({
  value: l.value, label: l.label,
  lo: i === 0 ? MIN : l.rating,
  hi: i === SKILL_LEVELS.length - 1 ? MAX : SKILL_LEVELS[i + 1].rating,
}))

export type Range = { min: number; max: number }

export const bandIndexOf = (rating: number): number => LEVEL_BANDS.findIndex(b => b.value === skillLevelForRating(rating))
export const bandRange = (a: number, b: number): Range => {
  const lo = Math.max(0, Math.min(a, b)), hi = Math.min(LEVEL_BANDS.length - 1, Math.max(a, b))
  return { min: LEVEL_BANDS[lo].lo, max: LEVEL_BANDS[hi].hi }
}
export const ANY_RANGE: Range = { min: MIN, max: MAX }

export type Preset = 'similar' | 'wider' | 'any'

// "Similar to me" is your own level; "A bit wider" adds the level either side. No rating, no personal choices.
export function presetRanges(rating: number | null | undefined): { similar: Range; wider: Range } | null {
  if (rating == null || !Number.isFinite(rating)) return null
  const i = bandIndexOf(rating)
  return { similar: bandRange(i, i), wider: bandRange(i - 1, i + 1) }
}

const same = (a: Range, b: Range) => Math.abs(a.min - b.min) < 1e-9 && Math.abs(a.max - b.max) < 1e-9

// Which quick choice the current range is exactly, or null when it is a custom range.
export function activePreset(range: Range, openToAll: boolean, rating: number | null | undefined): Preset | null {
  if (openToAll || same(range, ANY_RANGE)) return 'any'
  const p = presetRanges(rating)
  if (p && same(range, p.similar)) return 'similar'
  if (p && same(range, p.wider)) return 'wider'
  return null
}

export type Coverage = 'full' | 'part' | 'none'
// How much of each level a range covers: all of it, some of it (an exact range cut a level short), or none.
export function coverage(range: Range): Coverage[] {
  return LEVEL_BANDS.map(b => (range.min <= b.lo && range.max >= b.hi ? 'full' : range.max > b.lo && range.min < b.hi ? 'part' : 'none'))
}

// First and last level a range touches.
export function coveredSpan(range: Range): [number, number] | null {
  const c = coverage(range)
  const first = c.findIndex(x => x !== 'none')
  if (first < 0) return null
  return [first, c.length - 1 - [...c].reverse().findIndex(x => x !== 'none')]
}

// What tapping a level does to the range. Levels always stay next to each other and at least one
// is always kept: tapping outside the range extends it (filling any gap), tapping an end level
// drops it, tapping a middle level makes it the only one, tapping the only level changes nothing.
export function toggleBand(range: Range, i: number): Range {
  const span = coveredSpan(range)
  if (!span) return bandRange(i, i)
  const [a, b] = span
  if (i < a) return bandRange(i, b)
  if (i > b) return bandRange(a, i)
  if (a === b) return bandRange(a, b)
  if (i === a) return bandRange(a + 1, b)
  if (i === b) return bandRange(a, b - 1)
  return bandRange(i, i)
}

// "Improver", "Improver to Intermediate", or "Every level", for the summary under the levels.
export function describeRange(range: Range): string {
  if (same(range, ANY_RANGE)) return 'Every level'
  const span = coveredSpan(range)
  if (!span) return ''
  const [a, b] = span
  return a === b ? LEVEL_BANDS[a].label : `${LEVEL_BANDS[a].label} to ${LEVEL_BANDS[b].label}`
}
