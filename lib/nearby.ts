// "Clubs near me", as pure functions (client-safe, no server imports): distances,
// ordering the clubs a player could book, and the tags shown on each row. The
// player's own position never leaves their phone: it is only used here to sort.
import type { OfferLite } from '@/lib/offer-rules'

export type LatLng = { lat: number; lng: number }

export const validCoords = (lat: unknown, lng: unknown): boolean =>
  typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng) &&
  lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && !(lat === 0 && lng === 0)

// Straight-line distance over the earth's surface, in km.
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371, rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

// "0.6" under 10 km, whole numbers beyond.
export const formatKm = (km: number): string => (km < 10 ? (Math.round(km * 10) / 10).toFixed(1) : String(Math.round(km)))

export type NearbyInput = { slug: string; lat?: number | null; lng?: number | null; approx?: boolean; bookable: boolean }
export type NearbyRow<T extends NearbyInput> = T & { km: number | null; precise: boolean }

// A club whose position an owner has set, otherwise the one built in.
export function coordsFor(v: { slug: string; lat?: number; lng?: number; approx?: boolean }, overrides: Record<string, LatLng> | undefined): { lat: number; lng: number; approx: boolean } | null {
  const o = overrides?.[v.slug]
  if (o && validCoords(o.lat, o.lng)) return { lat: o.lat, lng: o.lng, approx: false }
  return validCoords(v.lat, v.lng) ? { lat: v.lat!, lng: v.lng!, approx: !!v.approx } : null
}

// Clubs a player can book come first, nearest first; clubs that can't be booked yet
// follow (also nearest first); a club with no position goes last. A club known only
// to its city is shown without a distance, since a number would pretend to be exact.
export function rankNearby<T extends NearbyInput>(items: T[], pos: LatLng): NearbyRow<T>[] {
  const rows = items.map(it => {
    const has = validCoords(it.lat, it.lng)
    return { ...it, km: has ? distanceKm(pos, { lat: it.lat!, lng: it.lng! }) : null, precise: has && !it.approx } as NearbyRow<T>
  })
  const key = (r: NearbyRow<T>) => (r.km === null ? Infinity : r.km)
  return rows.sort((a, b) => Number(!a.bookable) - Number(!b.bookable) || key(a) - key(b) || a.slug.localeCompare(b.slug))
}

export type Deal = { percent: number; date: string; start: string; end: string }

// The best offer still open at a club: the biggest discount, then the soonest.
export function dealAt(offers: OfferLite[], slug: string, nowMs: number): Deal | null {
  const open = offers.filter(o => o.venue_slug === slug && o.status === 'active' && Date.parse(o.closes_at) > nowMs)
  if (open.length === 0) return null
  open.sort((a, b) => b.discount_percent - a.discount_percent || (a.date + a.start_time).localeCompare(b.date + b.start_time))
  const o = open[0]
  return { percent: o.discount_percent, date: o.date, start: o.start_time.slice(0, 5), end: o.end_time.slice(0, 5) }
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export function dealLabel(d: Deal, todayStr: string): string {
  const day = d.date === todayStr ? '' : `${DAYS[new Date(d.date + 'T12:00:00Z').getUTCDay()]} `
  return `${day}${d.percent}% off ${d.start}–${d.end}`
}
