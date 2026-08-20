export type SkillLevel = 'beginner' | 'improver' | 'intermediate' | 'advanced' | 'elite'

export const SKILL_LEVELS: { value: SkillLevel; label: string; desc: string; rating: number }[] = [
  { value: 'beginner',     label: 'Beginner',     desc: 'Just starting out',       rating: 1.0 },
  { value: 'improver',     label: 'Improver',     desc: 'Getting the basics down', rating: 2.0 },
  { value: 'intermediate', label: 'Intermediate', desc: 'Comfortable rallying',    rating: 3.0 },
  { value: 'advanced',     label: 'Advanced',     desc: 'Consistent & competitive', rating: 4.5 },
  { value: 'elite',        label: 'Elite',        desc: 'Tournament level',        rating: 6.0 },
]

// The single source of truth for turning a numeric skill_rating back into a
// tier -- skill_rating is now kept up to date by actual match results
// (see apply_skill_rating_delta / app/api/record-match), so this is what
// should drive any player-facing skill label instead of the one-time,
// never-corrected skill_level string picked at onboarding.
export function skillLevelForRating(rating: number | null | undefined): SkillLevel {
  if (rating == null) return 'beginner'
  let best: SkillLevel = SKILL_LEVELS[0].value
  for (const level of SKILL_LEVELS) {
    if (rating >= level.rating) best = level.value
  }
  return best
}

export function skillLabelForRating(rating: number | null | undefined): string {
  const level = SKILL_LEVELS.find(l => l.value === skillLevelForRating(rating))
  return level?.label ?? 'Beginner'
}
