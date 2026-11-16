import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase-admin'
import { loadTeamCaller } from '@/lib/team-server'
import { COUNTRIES, VENUES } from '@/lib/venues'
import { isManagerRole, isOwnerRole } from '@/lib/view-mode'
import { covers, scopeLabel, scopeOf, type TeamScope } from '@/lib/team'
import TeamView from '@/components/admin/TeamView'
import InviteTeam, { type PendingInvite } from '@/components/admin/InviteTeam'

export const metadata = { title: 'Team' }

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

  // Waiting invites inside this owner's reach. A missing table (database change 033 not run yet) just means "not switched on".
  const { data: inviteRows, error: inviteError } = await createAdminClient()
    .from('team_invites' as any)
    .select('id, email, role, managed_venue_slug, managed_country, expires_at, used_at, cancelled_at')
    .is('used_at', null).is('cancelled_at', null).gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
  const invites: PendingInvite[] = ((inviteRows ?? []) as any[])
    .filter(r => covers(caller.reach, scopeOf(r)))
    .map(r => ({ id: r.id, email: r.email, role: r.role, scopeLabel: scopeLabel(scopeOf(r)), expiresAt: r.expires_at }))
  const canGrantAll = !caller.reach.venueSlug && !caller.reach.country

  return (
    // On a computer the team list takes the width and the invite panel sits beside it; on a phone
    // they stack as before (invite first).
    <div className="mx-auto max-w-2xl lg:max-w-none">
      <h1 className="text-2xl font-semibold">Team</h1>
      <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Who can run your clubs in the app</p>
      <div className="mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-6 lg:items-start">
      <div className="lg:col-start-2 lg:row-start-1">
        <InviteTeam clubs={clubs} canGrantAll={canGrantAll} defaultClub={defaultClub} invites={invites} ready={!inviteError} />
      </div>
      <div className="lg:col-start-1 lg:row-start-1 min-w-0">
        <TeamView members={members} clubs={clubs} countries={countries} canGrantAll={canGrantAll} defaultClub={defaultClub} />
      </div>
      </div>
    </div>
  )
}
