// Server-only helpers for the Team routes and page. The caller is always
// identified from their own session; the service-role client is used only after
// that, because changing someone's role is not something row-level security lets
// a staff account do (and shouldn't).
import { createServerClient } from '@/lib/supabase-server'
import { reachOf, type Reach } from '@/lib/team'

export type TeamCaller = { id: string; role: string; reach: Reach; homeVenueSlug: string | null; name: string | null }

export async function loadTeamCaller(): Promise<TeamCaller | null> {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  const { data: p } = await supabase
    .from('profiles')
    .select('role, nickname, full_name, home_venue_slug, managed_venue_slug, managed_country')
    .eq('id', session.user.id)
    .single()
  if (!p) return null
  return {
    id: session.user.id,
    role: (p as any).role,
    reach: reachOf(p as any),
    homeVenueSlug: (p as any).home_venue_slug ?? null,
    name: (p as any).nickname ?? (p as any).full_name ?? null,
  }
}
