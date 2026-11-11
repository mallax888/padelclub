import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase-admin'
import { loadTeamCaller } from '@/lib/team-server'
import { COUNTRIES, VENUES } from '@/lib/venues'
import { isManagerRole, isOwnerRole } from '@/lib/view-mode'
import { covers, scopeLabel, scopeOf, type TeamScope } from '@/lib/team'
import TeamView from '@/components/admin/TeamView'

export const dynamic = 'force-dynamic'

export default async function TeamPage() {
  const caller = await loadTeamCaller()
  if (!caller || !isManagerRole(caller.role)) redirect('/book')
  // Front desk never sees the team.
  if (!isOwnerRole(caller.role)) redirect('/admin/today')

  // The service-role client only after the caller has been checked as an owner:
  // the team list needs everyone's role, which an ordinary session can't read
  // across clubs.
  const { data } = await createAdminClient()
    .from('profiles')
    .select('id, full_name, nickname, email, role, managed_venue_slug, managed_country')
    .in('role', ['staff', 'admin'])
    .order('full_name')

  const members = ((data ?? []) as any[])
    .map(p => ({ p, scope: scopeOf(p) as TeamScope }))
    // An owner for one club or country only sees the people inside their reach.
    .filter(({ p, scope }) => p.id === caller.id || covers(caller.reach, scope))
    .map(({ p, scope }) => ({
      id: p.id as string,
      name: (p.nickname ?? p.full_name ?? 'Unnamed') as string,
      email: (p.email ?? '') as string,
      role: p.role as 'admin' | 'staff',
      scope,
      scopeLabel: scopeLabel(scope),
      isMe: p.id === caller.id,
    }))

  const clubs = VENUES.filter(v => covers(caller.reach, { kind: 'club', venueSlug: v.slug }))
    .map(v => ({ slug: v.slug, name: v.name }))
    .sort((a, b) => a.name.localeCompare(b.name))
  const countries = caller.reach.venueSlug ? [] : caller.reach.country ? [caller.reach.country] : COUNTRIES.map(c => c.name)
  const defaultClub =
    (caller.reach.venueSlug && clubs.some(c => c.slug === caller.reach.venueSlug) ? caller.reach.venueSlug : null)
    ?? (caller.homeVenueSlug && clubs.some(c => c.slug === caller.homeVenueSlug) ? caller.homeVenueSlug : null)
    ?? clubs[0]?.slug ?? ''

  return <TeamView members={members} clubs={clubs} countries={countries} canGrantAll={!caller.reach.venueSlug && !caller.reach.country} defaultClub={defaultClub} />
}
