// The rules of club membership plans, as pure functions (client-safe, no server
// imports): the standard plans a club has until its owner edits them, which plans a
// club offers, what a member's plan gives them at a club, and what an owner may
// enter. Used by the booking screens, the price check on the server, the membership
// page and the owner's editor, so they all agree.
import { MEMBERSHIP_CONFIG } from '@/types/database'
import { currencyForVenueSlug, localPriceFromNzd } from '@/lib/currency'

export const BUILT_IN_KEYS = ['casual', 'club', 'pro'] as const
export const DISCOUNT_CHOICES = [0, 10, 15, 20, 25, 30] as const
export const MAX_PLANS = 8
export const MAX_PERKS = 5
export const MAX_PERK_LENGTH = 80
export const MAX_PRICE = 10000
export const MIN_WINDOW = 1
export const MAX_WINDOW = 60
export const MAX_GRANT_DAYS = 800

export type PlanRow = {
  id?: string
  venue_slug: string
  key: string
  name: string
  price: number | string
  discount_percent: number
  booking_window_days: number
  perks: string[] | null
  active: boolean
  sort: number
}

export type Plan = {
  key: string
  name: string
  price: number // in the club's own currency, whole units; 0 = free
  discountPercent: number
  windowDays: number
  perks: string[] // extra lines the owner wrote (their own promise to deliver)
  active: boolean
  sort: number
  builtIn: boolean
  featured: boolean
}

export const isBuiltIn = (key: string) => (BUILT_IN_KEYS as readonly string[]).includes(key)

// The plans every club has until its owner changes them: today's Casual, Club and Pro,
// priced in the club's currency the way the old price list was converted.
export function defaultPlans(venueSlug: string | null | undefined): Plan[] {
  const currency = currencyForVenueSlug(venueSlug)
  return BUILT_IN_KEYS.map((key, i) => {
    const c = MEMBERSHIP_CONFIG[key]
    return {
      key, name: c.name, price: localPriceFromNzd(c.priceNzd, currency), discountPercent: Math.round(c.discount * 100),
      windowDays: c.bookingWindowDays, perks: [], active: true, sort: i, builtIn: true, featured: !!c.featured,
    }
  })
}

const fromRow = (r: PlanRow): Plan => ({
  key: r.key, name: r.name, price: Number(r.price) || 0, discountPercent: Number(r.discount_percent) || 0,
  windowDays: Number(r.booking_window_days) || 14, perks: (r.perks ?? []).filter(Boolean), active: r.active !== false,
  sort: Number(r.sort) || 0, builtIn: isBuiltIn(r.key), featured: r.key === 'club',
})

// The plans a club has: its own rows, or the standard three if it has none. Casual
// is always there.
export function effectivePlans(rows: PlanRow[] | null | undefined, venueSlug: string | null | undefined): Plan[] {
  const mine = (rows ?? []).filter(r => r.venue_slug === venueSlug)
  const defaults = defaultPlans(venueSlug)
  if (mine.length === 0) return defaults
  const plans = mine.map(fromRow).sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name))
  if (!plans.some(p => p.key === 'casual')) plans.unshift(defaults[0])
  return plans
}

// The plan for a key. A key the club no longer has (or none) is Casual.
export function planOf(plans: Plan[], key: string | null | undefined): Plan {
  return plans.find(p => p.key === key) ?? plans.find(p => p.key === 'casual') ?? defaultPlans(null)[0]
}

// What a member's plan takes off a booking at this club, as a fraction. Plans belong
// to the member's home club: elsewhere they pay that club's normal price. A member
// with no home club keeps the standard plan's discount, as before clubs had plans.
export function memberDiscount(rows: PlanRow[] | null | undefined, o: { tier: string | null | undefined; homeSlug: string | null | undefined; bookingSlug: string | null | undefined }): number {
  const tier = o.tier ?? 'casual'
  if (!o.homeSlug) return (MEMBERSHIP_CONFIG as any)[tier]?.discount ?? 0
  if (o.bookingSlug !== o.homeSlug) return 0
  return planOf(effectivePlans(rows, o.homeSlug), tier).discountPercent / 100
}

// How many days ahead a member can book at this club: their plan's window at their
// home club, otherwise the club's Casual window.
export function memberWindowDays(rows: PlanRow[] | null | undefined, o: { tier: string | null | undefined; homeSlug: string | null | undefined; venueSlug: string | null | undefined }): number {
  const tier = o.tier ?? 'casual'
  if (!o.homeSlug) return (MEMBERSHIP_CONFIG as any)[tier]?.bookingWindowDays ?? 14
  const slug = o.venueSlug ?? o.homeSlug
  const plans = effectivePlans(rows, slug)
  return planOf(plans, slug === o.homeSlug ? tier : 'casual').windowDays
}

// The lines shown to players: what the plan really does, then the owner's own.
export function planLines(p: Plan): string[] {
  const lines: string[] = []
  if (p.discountPercent > 0) lines.push(`${p.discountPercent}% off every court booking`)
  else if (p.key === 'casual') lines.push('Book courts at the normal price')
  lines.push(`Book up to ${p.windowDays} days ahead`)
  return [...lines, ...p.perks]
}

// "coaching-squad" -> "Coaching squad", for places that only have the key.
export function tierLabel(key: string | null | undefined): string {
  const s = String(key ?? 'casual').replace(/-/g, ' ').trim()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function slugKey(name: string, taken: string[]): string {
  const base = (name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'plan')
  let key = base, n = 2
  while (taken.includes(key)) key = `${base}-${n++}`
  return key
}

export type PlanInput = { name: string; price: number; discountPercent: number; windowDays: number; perks: string[]; active: boolean }

// What an owner may enter. `existing` is the club's current plans; `key` is the plan
// being edited (null for a new one). Returns a plain-words problem, or null.
export function validatePlanInput(input: PlanInput, key: string | null, existing: Plan[]): string | null {
  const name = String(input.name ?? '').trim()
  if (name.length < 1 || name.length > 40) return 'Give the plan a name (up to 40 characters).'
  if (existing.some(p => p.key !== key && p.name.toLowerCase() === name.toLowerCase())) return 'You already have a plan with that name.'
  if (key === null && existing.length >= MAX_PLANS) return `A club can have up to ${MAX_PLANS} plans.`
  if (key !== null && !existing.some(p => p.key === key)) return 'We could not find that plan.'
  if (!Number.isInteger(input.price) || input.price < 0 || input.price > MAX_PRICE) return `The price must be a whole number up to ${MAX_PRICE}.`
  if (key === 'casual') {
    if (input.price !== 0) return 'Casual is always free.'
    if (!input.active) return 'Casual is always on.'
    if (input.discountPercent !== 0) return 'Casual has no discount.'
  } else if (input.price < 1) return 'A paid plan needs a price of at least 1.'
  if (!(DISCOUNT_CHOICES as readonly number[]).includes(input.discountPercent)) return 'Choose a discount of none, 10, 15, 20, 25 or 30%.'
  if (!Number.isInteger(input.windowDays) || input.windowDays < MIN_WINDOW || input.windowDays > MAX_WINDOW) return `Days ahead must be between ${MIN_WINDOW} and ${MAX_WINDOW}.`
  if (!Array.isArray(input.perks) || input.perks.length > MAX_PERKS) return `A plan can list up to ${MAX_PERKS} extra perks.`
  if (input.perks.some(p => typeof p !== 'string' || p.trim().length < 1 || p.trim().length > MAX_PERK_LENGTH)) return `Each perk must be 1 to ${MAX_PERK_LENGTH} characters.`
  return null
}

// What a plan is worth to the club each month: price x members who paid for it
// (a plan given for free brings in nothing).
export function monthlyIncome(plans: Plan[], counts: Record<string, number>, granted: Record<string, number>): number {
  return plans.reduce((sum, p) => sum + (p.key === 'casual' ? 0 : p.price * Math.max(0, (counts[p.key] ?? 0) - (granted[p.key] ?? 0))), 0)
}

// The date a given plan ends, validated: a day after today, within MAX_GRANT_DAYS.
export function validateGrantEnd(endsOn: string, todayStr: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endsOn) || Number.isNaN(Date.parse(endsOn + 'T00:00:00Z'))) return 'Choose an end date.'
  if (endsOn <= todayStr) return 'The end date must be after today.'
  const days = (Date.parse(endsOn + 'T00:00:00Z') - Date.parse(todayStr + 'T00:00:00Z')) / 86400000
  if (days > MAX_GRANT_DAYS) return 'That end date is too far ahead.'
  return null
}
