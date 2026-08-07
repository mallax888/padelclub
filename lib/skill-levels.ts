export type SkillLevel = 'beginner' | 'improver' | 'intermediate' | 'advanced' | 'elite'

export const SKILL_LEVELS: { value: SkillLevel; label: string; desc: string; rating: number }[] = [
  { value: 'beginner',     label: 'Beginner',     desc: 'Just starting out',       rating: 1.0 },
  { value: 'improver',     label: 'Improver',     desc: 'Getting the basics down', rating: 2.0 },
  { value: 'intermediate', label: 'Intermediate', desc: 'Comfortable rallying',    rating: 3.0 },
  { value: 'advanced',     label: 'Advanced',     desc: 'Consistent & competitive', rating: 4.5 },
  { value: 'elite',        label: 'Elite',        desc: 'Tournament level',        rating: 6.0 },
]
