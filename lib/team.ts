// Who may add, change or remove a member of a club's team, and how a team
// member's "reach" (which clubs they cover) is stored. Pure functions of their
// inputs so the rules that matter -- you can't change yourself, an owner can only
// act inside their own reach -- are tested without a server or a database.
import { COUNTRIES, VENUES, getVenue } from '@/lib/venues'

export type TeamRole = 'admin' | 'staff' // Owner | Front desk
export type Reach = { venueSlug: string | null; country: string | null }
export type TeamScope = { kind: 'all' } | { kind: 'country'; country: string } | { kind: 'club'; venueSlug: string }

type ScopeColumns = { managed_venue_slug?: string | null; managed_country?: string | null }

export const countryOfVenue = (slug: string): string | null =>
  COUNTRIES.find(c => c.regions.includes(getVenue(slug).region))?.name ?? null

// A club wins over a country, the same precedence the dashboard uses.
export function scopeOf(p: ScopeColumns): TeamScope {
  if (p.managed_venue_slug) return { kind: 'club', venueSlug: p.managed_venue_slug }
  if (p.managed_country) return { kind: 'country', country: p.managed_country }
  return { kind: 'all' }
}

export function reachOf(p: ScopeColumns): Reach {
  return { venueSlug: p.managed_venue_slug ?? null, country: p.managed_venue_slug ? null : p.managed_country ?? null }
}

export function scopeColumns(s: TeamScope): { managed_venue_slug: string | null; managed_country: string | null } {
  return {
    managed_venue_slug: s.kind === 'club' ? s.venueSlug : null,
    managed_country: s.kind === 'country' ? s.country : null,
  }
}

export function scopeLabel(s: TeamScope): string {
  if (s.kind === 'all') return 'All clubs'
  if (s.kind === 'country') return `All clubs in ${s.country}`
  return `${VENUES.find(v => v.slug === s.venueSlug)?.name ?? s.venueSlug} only`
}

export function isValidScope(s: unknown): s is TeamScope {
  const x = s as any
  if (!x || typeof x !== 'object') return false
  if (x.kind === 'all') return true
  if (x.kind === 'country') return typeof x.country === 'string' && COUNTRIES.some(c => c.name === x.country)
  if (x.kind === 'club') return typeof x.venueSlug === 'string' && VENUES.some(v => v.slug === x.venueSlug)
  return false
}

// Does `reach` (a person's own coverage) include everything `scope` covers?
// An owner for one club covers only that club; for a country, that country and
// its clubs; unscoped, everything.
export function covers(reach: Reach, scope: TeamScope): boolean {
  if (reach.venueSlug) return scope.kind === 'club' && scope.venueSlug === reach.venueSlug
  if (reach.country) {
    if (scope.kind === 'club') return countryOfVenue(scope.venueSlug) === reach.country
    if (scope.kind === 'country') return scope.country === reach.country
    return false
  }
  return true
}

export type TeamAction = 'add' | 'update' | 'remove'
export type TeamTarget = { id: string; role: string; scope: TeamScope }
export type PlanResult =
  | { ok: true; update: { role: 'member' | TeamRole; managed_venue_slug: string | null; managed_country: string | null } }
  | { ok: false; status: number; error: string }

const fail = (status: number, error: string): PlanResult => ({ ok: false, status, error })
const isTeamRole = (r: unknown): r is TeamRole => r === 'admin' || r === 'staff'

export function planTeamChange(input: {
  action: TeamAction
  caller: { id: string; role: string; reach: Reach }
  target: TeamTarget | null
  role?: unknown
  scope?: unknown
  otherOwners: number // owners left on the team besides the target
}): PlanResult {
  const { action, caller, target } = input
  // The owner check comes first: nothing below should leak to anyone else.
  if (caller.role !== 'admin') return fail(403, 'Only an owner can manage the team.')
  if (!target) return fail(404, 'We could not find that person.')
  if (target.id === caller.id) return fail(400, "You can't change your own role. Ask another owner.")

  const onTeam = target.role === 'admin' || target.role === 'staff'

  if (action === 'add') {
    if (onTeam) return fail(400, 'They are already on the team.')
    if (!isTeamRole(input.role)) return fail(400, 'Choose Owner or Front desk.')
    if (!isValidScope(input.scope)) return fail(400, 'Choose which clubs they cover.')
    if (!covers(caller.reach, input.scope)) return fail(403, "You can only give access to clubs you cover yourself.")
    return { ok: true, update: { role: input.role, ...scopeColumns(input.scope) } }
  }

  if (!onTeam) return fail(400, 'They are not on the team.')
  // An owner can only touch people inside their own reach.
  if (!covers(caller.reach, target.scope)) return fail(403, "That person covers clubs outside your reach.")
  // Defensive: with the self-change rule the caller always remains an owner.
  if (target.role === 'admin' && input.otherOwners < 1 && (action === 'remove' || input.role !== 'admin')) {
    return fail(400, 'The club needs at least one owner.')
  }

  if (action === 'remove') return { ok: true, update: { role: 'member', managed_venue_slug: null, managed_country: null } }

  if (!isTeamRole(input.role)) return fail(400, 'Choose Owner or Front desk.')
  if (!isValidScope(input.scope)) return fail(400, 'Choose which clubs they cover.')
  if (!covers(caller.reach, input.scope)) return fail(403, "You can only give access to clubs you cover yourself.")
  return { ok: true, update: { role: input.role, ...scopeColumns(input.scope) } }
}

// Free text into a PostgREST `or=(...)` filter: strip the characters that could
// end the value or start another condition (commas, brackets, wildcards, quotes).
export const searchTerm = (q: string): string => q.replace(/[,()*%\\"\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60)
