import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { loadTeamCaller } from '@/lib/team-server'
import { covers } from '@/lib/team'
import { VENUES } from '@/lib/venues'
import { venueClock } from '@/lib/today'
import { formatsReady } from '@/lib/tournament-server'
import NewTournamentForm from '@/components/tournaments/NewTournamentForm'
import { FLOW_FRAME } from '@/lib/flow-frame'

export const metadata = { title: 'New tournament' }

export default async function NewTournamentPage() {
  const caller = await loadTeamCaller()
  if (!caller || (caller.role !== 'staff' && caller.role !== 'admin')) redirect('/tournaments')

  // only the clubs this person looks after
  const venueSlugs = VENUES.filter(v => covers(caller.reach, { kind: 'club', venueSlug: v.slug })).map(v => v.slug)

  const supabase = createServerClient()
  const { data: players } = await supabase
    .from('profiles')
    .select('id, full_name, nickname')
    .not('role', 'eq', 'staff')
    .order('full_name', { ascending: true })

  // the club they usually work in comes pre-selected
  const myClub = [caller.reach.venueSlug, caller.homeVenueSlug].find(s => s && venueSlugs.includes(s)) ?? ''

  // tomorrow at the club, worked out here so the server and browser agree
  const defaultDate = venueClock(myClub || venueSlugs[0] || 'auckland-takapuna', Date.now() + 24 * 60 * 60 * 1000).date
  const ready = await formatsReady(createAdminClient())

  return (
    <div>
      <div className={`mb-6 ${FLOW_FRAME}`}>
        <h1 className="text-2xl font-semibold">New tournament</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Plan the day, pick a format, add your players</p>
      </div>
      <NewTournamentForm players={players ?? []} venueSlugs={venueSlugs} defaultVenue={myClub} defaultDate={defaultDate} formatsReady={ready} />
    </div>
  )
}
