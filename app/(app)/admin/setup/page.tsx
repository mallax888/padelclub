import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import { loadTeamCaller } from '@/lib/team-server'
import { VENUES, getVenue } from '@/lib/venues'
import { currencyForVenueSlug } from '@/lib/currency'
import { covers } from '@/lib/team'
import { isManagerRole, isOwnerRole } from '@/lib/view-mode'
import { loadVenueSettings } from '@/lib/venue-settings'
import { loadRegularRules } from '@/lib/regulars'
import ClubSetup, { type SetupClub } from '@/components/admin/ClubSetup'
import { createAdminClient } from '@/lib/supabase-admin'
import { effectivePlans } from '@/lib/plan-rules'
import { loadPlanRows, planStats } from '@/lib/club-plans'

export const metadata = { title: 'Club setup' }

export const dynamic = 'force-dynamic'

export default async function SetupPage({ searchParams }: { searchParams?: { venue?: string } }) {
  const caller = await loadTeamCaller()
  if (!caller || !isManagerRole(caller.role)) redirect('/book')
  // Club settings are an owner's job: front desk is sent back to Today.
  if (!isOwnerRole(caller.role)) redirect('/admin/today')

  const inReach = VENUES.filter(v => covers(caller.reach, { kind: 'club', venueSlug: v.slug }))
  const supabase = createServerClient()
  const [{ data: courtRows }, settings] = await Promise.all([
    supabase.from('courts').select('id, name, type, venue_slug, price_per_hour, price_per_hour_peak, is_indoor, is_active').order('name'),
    loadVenueSettings(supabase),
  ])
  const courtsBy = new Map<string, any[]>()
  for (const c of (courtRows ?? []) as any[]) {
    if (c.is_active === false) continue
    courtsBy.set(c.venue_slug, [...(courtsBy.get(c.venue_slug) ?? []), c])
  }

  const statusOf = (slug: string): SetupClub['status'] => {
    const n = courtsBy.get(slug)?.length ?? 0
    if (n === 0) return 'new'
    return settings[slug] && settings[slug].isOpen === false ? 'ready' : 'live'
  }
  const clubs: SetupClub[] = inReach.map(v => ({ slug: v.slug, name: v.name, region: v.region, status: statusOf(v.slug) }))
    .sort((a, b) => a.name.localeCompare(b.name))
  if (clubs.length === 0) redirect('/admin/today')

  const wanted = searchParams?.venue
  const slug = clubs.some(c => c.slug === wanted) ? wanted!
    : clubs.some(c => c.slug === caller.reach.venueSlug) ? caller.reach.venueSlug!
    : clubs.some(c => c.slug === caller.homeVenueSlug) ? caller.homeVenueSlug!
    : clubs[0].slug

  const venue = getVenue(slug)
  const courts = (courtsBy.get(slug) ?? []).map(c => ({
    id: c.id as string, name: c.name as string, type: c.type as string,
    pricePerHour: Number(c.price_per_hour) || 0, pricePerHourPeak: c.price_per_hour_peak != null ? Number(c.price_per_hour_peak) : null,
  }))
  const row = settings[slug]
  // This club's rules for weekly regulars; null hides the section until the database change is run.
  const regProbe: any = await (supabase as any).from('regular_settings').select('venue_slug').limit(1)
  const regRules = regProbe.error ? null : ((await loadRegularRules(supabase))[slug] ?? { enabled: true, peakCap: null })

  // This club's membership plans and figures; null (card hidden) until the club plans
  // database change has been run.
  const admin = createAdminClient()
  const planRows = await loadPlanRows(admin, [slug])
  const plans = effectivePlans(planRows, slug)
  const memberships = planRows === null ? null : {
    plans,
    stats: await planStats(admin, slug, plans),
    examplePrice: courts.length ? Math.max(...courts.map(c => c.pricePerHourPeak ?? c.pricePerHour)) : null,
  }

  return (
    <ClubSetup
      key={slug}
      clubs={clubs}
      venue={{ slug, name: venue.name, address: venue.address.split(',').slice(0, 2).join(','), region: venue.region }}
      listed={venue.courts.map(c => ({ name: c.name, type: c.type, isIndoor: c.isIndoor }))}
      currency={currencyForVenueSlug(slug)}
      hours={row?.hours ?? null}
      isOpen={row ? row.isOpen : courts.length > 0}
      courts={courts}
      regulars={regRules}
      memberships={memberships}
    />
  )
}
