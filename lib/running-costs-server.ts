// Server-only: reads clubs' running costs. Null when the 042 database change has not been run (the Reports tab
// then looks as it always did and the settings card says so). Never call this for front desk.
import { costsFromRow, type RunningCosts } from '@/lib/running-costs'

export async function loadCostsFor(admin: any, venueSlugs: string[] | null): Promise<Record<string, RunningCosts> | null> {
  let q = admin.from('club_running_costs').select('venue_slug, monthly_cost, show_line')
  if (venueSlugs) q = q.in('venue_slug', venueSlugs)
  const { data, error } = await q
  if (error) return null
  const out: Record<string, RunningCosts> = {}
  for (const r of (data ?? []) as any[]) out[r.venue_slug] = costsFromRow(r)
  return out
}
