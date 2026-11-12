import { createServerClient } from '@/lib/supabase-server'
import BookingFlow from '@/components/booking/BookingFlow'
import { loadVenueSettings, loadVenueLocations } from '@/lib/venue-settings'
import { loadRegularRules } from '@/lib/regulars'
import { venueInstant, timezoneForVenueSlug } from '@/lib/timezone'
import { localDateStr } from '@/lib/utils'
import { loadOpenOffers } from '@/lib/offers'
import { loadPlanRows } from '@/lib/club-plans'

export const metadata = { title: 'Book a court' }

// How many past split partners to hand the booking flow. The picker shows the
// first few and everyone else is reachable through search, so this only needs
// to be deep enough to cover a regular group.
const RECENT_PARTNER_LIMIT = 12

export default async function BookPage() {
  const supabase = createServerClient()
  const [{ data: courts }, { data: { session } }, venueSettings] = await Promise.all([
    supabase.from('courts').select('*').eq('is_active', true),
    supabase.auth.getSession(),
    loadVenueSettings(supabase),
  ])
  const userId = session!.user.id
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  // The split picker used to load every profile in the database, alphabetically,
  // and render all of them -- fine at a dozen members, a scroll of strangers
  // once 36 clubs across three countries are live. Instead: the people this
  // member has actually split a court with, which booking_splits already
  // records, counted in both directions (courts they organised and courts they
  // were invited to). Anyone else is found by name via /api/players/search.
  const { data: splitRows } = await supabase
    .from('booking_splits')
    .select('user_id, invited_by')
    .or(`invited_by.eq.${userId},user_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(200)

  const tally = new Map<string, number>()
  for (const row of splitRows ?? []) {
    const other = row.invited_by === userId ? row.user_id : row.invited_by
    if (!other || other === userId) continue
    tally.set(other, (tally.get(other) ?? 0) + 1)
  }

  // Most-played-with first, so a regular four surfaces ahead of a one-off.
  const partnerIds = Array.from(tally.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, RECENT_PARTNER_LIMIT)
    .map(([id]) => id)

  const { data: partnerProfiles } = partnerIds.length
    ? await supabase.from('profiles').select('id, full_name, nickname').in('id', partnerIds)
    : { data: [] }

  const recentPlayers = partnerIds.flatMap(id => {
    const p = (partnerProfiles ?? []).find(x => x.id === id)
    return p ? [{ ...p, splitCount: tally.get(id)! }] : []
  })

  // The player's own waits (RLS lets them read only theirs). If the table isn't
  // there yet the waitlist simply stays off and full times read "Taken", as before.
  const waitRes: any = await (supabase as any)
    .from('waitlist')
    .select('id, venue_slug, date, start_time, duration_minutes, status, notified_at')
    .eq('user_id', userId)
    .in('status', ['waiting', 'notified'])
    .gte('date', localDateStr(new Date(Date.now() - 24 * 3600 * 1000)))
  const waitlistOn = !waitRes.error

  // Weekly regulars: on once their tables exist, with each club's own rules.
  const regularsProbe: any = await (supabase as any).from('regulars').select('id').limit(1)
  const regularsOn = !regularsProbe.error
  const regularRules = regularsOn ? await loadRegularRules(supabase) : {}
  const nowMs = Date.now()
  const waits = ((waitRes.data ?? []) as any[])
    .filter(w => venueInstant(w.date, String(w.start_time).slice(0, 5) + ':00', timezoneForVenueSlug(w.venue_slug)).getTime() > nowMs)
  // Tapping "a court just opened" opens on the most recent time they were told about.
  const told = waits.filter(w => w.status === 'notified').sort((a, b) => String(b.notified_at ?? '').localeCompare(String(a.notified_at ?? '')))[0]
  const waitPrefill = told ? { venueSlug: told.venue_slug as string, date: told.date as string, durationMinutes: told.duration_minutes as number } : null

  // Offers open right now (the player's own session sees only open ones). Tapping an
  // offer notification opens on the one at their home club, else the newest.
  const offers = await loadOpenOffers(supabase as any, nowMs)
  const plans = (await loadPlanRows(supabase as any)) ?? []
  const venueLocations = await loadVenueLocations(supabase)
  const mine = offers.filter(o => o.venue_slug === (profile as any)?.home_venue_slug)
  const pick = (mine.length ? mine : offers).slice().sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))[0]
  const offerPrefill = pick ? { venueSlug: pick.venue_slug, date: pick.date } : null

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Book a court</h1>
        <p className="text-sm text-gray-500 mt-1">Select a date, court and time to make your booking</p>
      </div>
      <BookingFlow courts={courts ?? []} profile={profile!} userId={userId} recentPlayers={recentPlayers} venueSettings={venueSettings}
        waits={waits} waitlistOn={waitlistOn} waitPrefill={waitPrefill}
        regularsOn={regularsOn} regularRules={regularRules} offers={offers} offerPrefill={offerPrefill} plans={plans} venueLocations={venueLocations} todayStr={localDateStr()} />
    </div>
  )
}
