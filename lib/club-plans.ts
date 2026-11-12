// Server side of per-club membership plans (see supabase/migrations/030_club_plans.sql
// and lib/plan-rules.ts): reading a club's plans, saving and removing them, giving a
// plan to a member for free, and the figures on the owner's screen. Prices are
// always taken from here on the server, never from the browser.
import type { SupabaseClient } from '@supabase/supabase-js'
import { getVenue } from '@/lib/venues'
import { timezoneForVenueSlug, venueInstant } from '@/lib/timezone'
import { formatDate } from '@/lib/utils'
import {
  defaultPlans, effectivePlans, isBuiltIn, monthlyIncome, slugKey, validateGrantEnd, validatePlanInput,
  type Plan, type PlanInput, type PlanRow,
} from '@/lib/plan-rules'

type Admin = SupabaseClient<any>

const tableMissing = (error: any): boolean =>
  !!error && (error.code === '42P01' || error.code === 'PGRST205' || error.code === '42703' || /(does not exist|schema cache)/i.test(String(error.message ?? '')))

const NOT_READY = "Club plans aren't switched on yet. Run the 030 database change first."

// Every club's plan rows (or just these clubs'). null when the table isn't there yet,
// which means "everyone has the standard plans, as before".
export async function loadPlanRows(db: any, venueSlugs?: string[] | null): Promise<PlanRow[] | null> {
  let q = db.from('club_plans').select('*')
  if (venueSlugs) q = q.in('venue_slug', venueSlugs)
  const { data, error } = await q
  if (error) return null
  return (data ?? []) as PlanRow[]
}

const toRow = (venueSlug: string, p: Plan) => ({
  venue_slug: venueSlug, key: p.key, name: p.name, price: p.price, discount_percent: p.discountPercent,
  booking_window_days: p.windowDays, perks: p.perks, active: p.active, sort: p.sort,
})

type Result<T = {}> = ({ ok: true } & T) | { ok: false; status: number; error: string }
const fail = (status: number, error: string): { ok: false; status: number; error: string } => ({ ok: false, status, error })

// An owner's first edit writes the standard plans down as this club's own, so editing
// one never changes the others.
async function ensureSeeded(db: any, venueSlug: string, rows: PlanRow[]): Promise<boolean> {
  if (rows.some(r => r.venue_slug === venueSlug)) return true
  const { error } = await db.from('club_plans').insert(defaultPlans(venueSlug).map(p => toRow(venueSlug, p)))
  return !error
}

export async function savePlan(admin: Admin, input: PlanInput & { venueSlug: string; key: string | null }): Promise<Result<{ key: string }>> {
  const db: any = admin
  const rows0 = await loadPlanRows(db, [input.venueSlug])
  if (rows0 === null) return fail(503, NOT_READY)
  if (!(await ensureSeeded(db, input.venueSlug, rows0))) return fail(500, 'Could not save the plan. Please try again.')
  const rows = (await loadPlanRows(db, [input.venueSlug])) ?? []
  const existing = effectivePlans(rows, input.venueSlug)

  const clean: PlanInput = {
    name: String(input.name ?? '').trim(), price: input.price, discountPercent: input.discountPercent, windowDays: input.windowDays,
    perks: (Array.isArray(input.perks) ? input.perks : []).map(p => String(p ?? '').trim()).filter(Boolean), active: !!input.active,
  }
  const problem = validatePlanInput(clean, input.key, existing)
  if (problem) return fail(400, problem)

  const key = input.key ?? slugKey(clean.name, existing.map(p => p.key))
  const fields = {
    name: clean.name, price: key === 'casual' ? 0 : clean.price, discount_percent: clean.discountPercent, booking_window_days: clean.windowDays,
    perks: clean.perks, active: key === 'casual' ? true : clean.active, updated_at: new Date().toISOString(),
  }
  if (rows.some(r => r.venue_slug === input.venueSlug && r.key === key)) {
    const { error } = await db.from('club_plans').update(fields).eq('venue_slug', input.venueSlug).eq('key', key)
    if (error) return fail(500, 'Could not save the plan. Please try again.')
  } else {
    const sort = Math.max(0, ...existing.map(p => p.sort)) + 1
    const { error } = await db.from('club_plans').insert({ venue_slug: input.venueSlug, key, sort, ...fields })
    if (error) return fail(500, 'Could not save the plan. Please try again.')
  }
  return { ok: true, key }
}

// Remove a plan the club made itself, once nobody is on it. The standard three can
// only be switched off.
export async function removePlan(admin: Admin, venueSlug: string, key: string): Promise<Result> {
  const db: any = admin
  if (isBuiltIn(key)) return fail(400, 'Casual, Club and Pro can be switched off but not removed.')
  const rows = await loadPlanRows(db, [venueSlug])
  if (rows === null) return fail(503, NOT_READY)
  if (!rows.some(r => r.venue_slug === venueSlug && r.key === key)) return fail(404, 'We could not find that plan.')
  const { data: on } = await db.from('profiles').select('id').eq('home_venue_slug', venueSlug).eq('membership_tier', key).limit(1)
  if ((on ?? []).length > 0) return fail(409, 'Members are still on that plan. Switch it off instead, or move them first.')
  const { error } = await db.from('club_plans').delete().eq('venue_slug', venueSlug).eq('key', key)
  if (error) return fail(500, 'Could not remove the plan. Please try again.')
  return { ok: true }
}

const todayIn = (tz: string, nowMs: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(nowMs))

export async function memberHomeClub(admin: Admin, userId: string): Promise<string | null | undefined> {
  const { data } = await (admin as any).from('profiles').select('home_venue_slug').eq('id', userId).maybeSingle()
  return data ? (data.home_venue_slug ?? null) : undefined // undefined = no such member
}

// Put a member on a plan for free until a date, or back on Casual. Whoever paid for
// a plan before is not refunded here; the new plan simply replaces it.
export async function setMemberPlan(
  admin: Admin,
  input: { userId: string; planKey: string; endsOn: string | null; grantedBy: string },
  nowMs: number = Date.now(),
): Promise<Result<{ planName: string }>> {
  const db: any = admin
  const home = await memberHomeClub(admin, input.userId)
  if (home === undefined) return fail(404, 'We could not find that member.')
  if (home === null) return fail(400, "That member hasn't chosen a home club yet, so they can't be on a club plan.")
  const rows = await loadPlanRows(db, [home])
  if (rows === null) return fail(503, NOT_READY)
  const plans = effectivePlans(rows, home)
  const plan = plans.find(p => p.key === input.planKey)
  if (!plan) return fail(400, "That plan isn't one of this club's plans.")

  const tz = timezoneForVenueSlug(home)
  let endsAt: string | null = null
  if (plan.key !== 'casual') {
    const problem = validateGrantEnd(String(input.endsOn ?? ''), todayIn(tz, nowMs))
    if (problem) return fail(400, problem)
    endsAt = venueInstant(input.endsOn!, '23:59:59', tz).toISOString()
  }

  await db.from('membership_subscriptions').update({ status: 'cancelled' }).eq('user_id', input.userId).eq('status', 'active')
  if (plan.key !== 'casual') {
    const { error } = await db.from('membership_subscriptions').insert({
      user_id: input.userId, tier: plan.key, status: 'active', started_at: new Date(nowMs).toISOString(), ends_at: endsAt, granted_by: input.grantedBy,
    })
    if (error) return fail(tableMissing(error) ? 503 : 500, tableMissing(error) ? NOT_READY : 'Could not give the plan. Please try again.')
  }
  const { error: profError } = await db.from('profiles').update({ membership_tier: plan.key }).eq('id', input.userId)
  if (profError) return fail(500, 'Could not change the plan. Please try again.')
  try {
    await db.from('notifications').insert({
      user_id: input.userId, type: 'membership_given',
      message: plan.key === 'casual'
        ? `Your plan at ${getVenue(home).name} is now Casual.`
        : `${getVenue(home).name} has given you the ${plan.name} plan until ${formatDate(input.endsOn!)}.`,
    })
  } catch { /* best effort */ }
  return { ok: true, planName: plan.name }
}

export type PlanStats = { counts: Record<string, number>; granted: Record<string, number>; paidMembers: number; income: number; givenAway: number }

// The owner's figures for one club: members per plan, how many were given free, what
// the plans bring in each month, and what member discounts gave away in 30 days.
export async function planStats(admin: Admin, venueSlug: string, plans: Plan[], nowMs: number = Date.now()): Promise<PlanStats> {
  const db: any = admin
  const { data: members } = await db.from('profiles').select('id, membership_tier').eq('home_venue_slug', venueSlug).limit(5000)
  const counts: Record<string, number> = {}
  for (const m of (members ?? []) as any[]) counts[m.membership_tier ?? 'casual'] = (counts[m.membership_tier ?? 'casual'] ?? 0) + 1
  const ids = ((members ?? []) as any[]).map(m => m.id as string)

  const granted: Record<string, number> = {}
  if (ids.length > 0) {
    const { data: subs } = await db.from('membership_subscriptions').select('user_id, tier, granted_by').eq('status', 'active').in('user_id', ids)
    const seen = new Set<string>()
    for (const s of (subs ?? []) as any[]) {
      if (!s.granted_by || seen.has(s.user_id)) continue
      seen.add(s.user_id)
      granted[s.tier] = (granted[s.tier] ?? 0) + 1
    }
  }

  let givenAway = 0
  const { data: courts } = await db.from('courts').select('id').eq('venue_slug', venueSlug)
  const courtIds = ((courts ?? []) as any[]).map(c => c.id as string)
  if (courtIds.length > 0) {
    const since = new Date(nowMs - 30 * 86400000).toISOString().slice(0, 10)
    const { data: bs } = await db.from('bookings').select('price_nzd, discount_applied, status').in('court_id', courtIds).gte('date', since).gt('discount_applied', 0).in('status', ['confirmed', 'completed'])
    for (const b of (bs ?? []) as any[]) {
      const d = Number(b.discount_applied) || 0
      if (d > 0 && d < 1) givenAway += (Number(b.price_nzd) || 0) * d / (1 - d)
    }
  }
  const paidMembers = plans.filter(p => p.key !== 'casual').reduce((n, p) => n + Math.max(0, (counts[p.key] ?? 0) - (granted[p.key] ?? 0)), 0)
  return { counts, granted, paidMembers, income: monthlyIncome(plans, counts, granted), givenAway: Math.round(givenAway) }
}
