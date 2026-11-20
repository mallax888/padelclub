// Server-only: reads a club's cancellation rule. A club with no row, or a database where the 037 change
// has not been run, simply has the default rule.
import { DEFAULT_RULE, ruleFromRow, type CancellationRule } from '@/lib/cancellation-rules'

export async function loadRule(admin: any, venueSlug: string | null | undefined): Promise<CancellationRule> {
  if (!venueSlug) return DEFAULT_RULE
  const { data, error } = await admin.from('cancellation_rules').select('free_hours, after_action').eq('venue_slug', venueSlug).maybeSingle()
  return error ? DEFAULT_RULE : ruleFromRow(data)
}

// Every rule that has been changed, keyed by club. Null when the 037 change has not been run (the settings card says so).
export async function loadRules(admin: any): Promise<Record<string, CancellationRule>> {
  const { data, error } = await admin.from('cancellation_rules').select('venue_slug, free_hours, after_action')
  const out: Record<string, CancellationRule> = {}
  if (error) return out
  for (const r of (data ?? []) as any[]) out[r.venue_slug] = ruleFromRow(r)
  return out
}

// Is the 037 database change in place?
export async function rulesAvailable(admin: any): Promise<boolean> {
  const { error } = await admin.from('cancellation_rules').select('venue_slug').limit(1)
  return !error
}
