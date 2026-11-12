// Per-club settings (see supabase/migrations/025_venue_settings.sql): whether a
// club is open for booking, and its opening hours. A club with no row is open
// with the default hours, exactly as every club behaved before this existed, so
// a deployment that hasn't run the migration -- or a club nobody has set up --
// keeps working unchanged.
import { parseWeek, weekOrDefault, type WeekHours } from '@/lib/venue-hours'

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
