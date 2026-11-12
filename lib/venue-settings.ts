// Per-club settings (see supabase/migrations/025_venue_settings.sql): whether a
// club is open for booking, and its opening hours. A club with no row is open
// with the default hours, exactly as every club behaved before this existed, so
// a deployment that hasn't run the migration -- or a club nobody has set up --
// keeps working unchanged.
import { parseWeek, weekOrDefault, type WeekHours } from '@/lib/venue-hours'
import { validCoords, type LatLng } from '@/lib/nearby'

export type VenueSettings = { isOpen: boolean; hours: WeekHours | null }
export type VenueSettingsMap = Record<string, VenueSettings>

// Postgres / PostgREST "that table isn't there".
export const isMissingTable = (error: any): boolean =>
  !!error && (error.code === '42P01' || error.code === 'PGRST205' || /venue_settings/.test(String(error.message ?? '')) && /(does not exist|schema cache)/i.test(String(error.message ?? '')))

export async function loadVenueSettings(supabase: any): Promise<VenueSettingsMap> {
  const { data, error } = await supabase.from('venue_settings').select('venue_slug, is_open_for_booking, hours')
  if (error || !data) return {}
  const map: VenueSettingsMap = {}
  for (const r of data as any[]) map[r.venue_slug] = { isOpen: r.is_open_for_booking !== false, hours: parseWeek(r.hours) }
  return map
}

// No row means open: a club only closes when someone closes it.
export const isOpenForBooking = (s: VenueSettingsMap | undefined, slug: string): boolean => s?.[slug]?.isOpen !== false
export const weekFor = (s: VenueSettingsMap | undefined, slug: string): WeekHours => weekOrDefault(s?.[slug]?.hours)

// Positions an owner has set for their own club (031_venue_location.sql). Read apart from
// the main settings so that a database without the two columns can't break opening hours:
// a failed read simply means "no club has set one", and the built-in positions are used.
export async function loadVenueLocations(supabase: any): Promise<Record<string, LatLng>> {
  const { data, error } = await supabase.from('venue_settings').select('venue_slug, lat, lng')
  if (error || !data) return {}
  const out: Record<string, LatLng> = {}
  for (const r of data as any[]) if (validCoords(r.lat, r.lng)) out[r.venue_slug] = { lat: Number(r.lat), lng: Number(r.lng) }
  return out
}

// Has the 031 database change been run?
export async function venueLocationReady(supabase: any): Promise<boolean> {
  const { error } = await supabase.from('venue_settings').select('lat').limit(1)
  return !error
}
