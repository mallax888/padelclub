// A club's own booking link: padelmate address/c/<club>. Anyone who opens it lands on that club's page, and anyone who
// creates an account from it becomes that club's player (home club) and is tagged "joined via link".
// Client-safe on purpose: the club page, sign-up and onboarding use it directly.
import { VENUES } from '@/lib/venues'

export const CLUB_COOKIE = 'pm_club'
const THIRTY_DAYS = 30 * 24 * 60 * 60

// Only clubs people can really book at have a link.
export const liveClubSlugs = (): string[] => VENUES.filter(v => v.isLive).map(v => v.slug)
export const isLiveClub = (slug: string | null | undefined): slug is string => !!slug && liveClubSlugs().includes(slug)

export const clubPath = (slug: string) => `/c/${slug}`
export const clubLinkUrl = (origin: string, slug: string) => `${origin.replace(/\/$/, '')}${clubPath(slug)}`
export const posterPath = (slug: string, look: 'dark' | 'lime' = 'dark') => `/c/${slug}/poster?look=${look}`
export const bookPathFor = (slug: string) => `/book?club=${encodeURIComponent(slug)}`
export const signupPathFor = (slug: string) => `/auth/signup?next=${encodeURIComponent(bookPathFor(slug))}`
export const loginPathFor = (slug: string) => `/auth/login?next=${encodeURIComponent(bookPathFor(slug))}`
// The address without the https://, for printing on a poster.
export const shortLink = (origin: string, slug: string) => clubLinkUrl(origin, slug).replace(/^https?:\/\//, '')

// Where someone who opened a club's link should land after signing in: straight to that club's booking.
export const bookPathForCookie = (value: string | null | undefined): string | null => (isLiveClub(value) ? bookPathFor(value) : null)

export function rememberClub(slug: string) {
  if (typeof document === 'undefined' || !isLiveClub(slug)) return
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${CLUB_COOKIE}=${slug}; Max-Age=${THIRTY_DAYS}; Path=/; SameSite=Lax${secure}`
}
export function forgetClub() {
  if (typeof document === 'undefined') return
  document.cookie = `${CLUB_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`
}
export function readClubCookie(): string | null {
  if (typeof document === 'undefined') return null
  const m = document.cookie.split('; ').find(c => c.startsWith(`${CLUB_COOKIE}=`))
  const v = m ? decodeURIComponent(m.slice(CLUB_COOKIE.length + 1)) : null
  return isLiveClub(v) ? v : null
}

// The three numbers on the owner's card, from the club's own player list. "Games" are games already played, so this
// is what the link has really brought in, not a forecast.
export type LinkPlayer = { viaLink: boolean; joined: string | null; games: number; booked: number }
export type LinkSummary = { joined30: number; joinedTotal: number; games: number; booked: number }
export function linkSummary(players: LinkPlayer[], today: string, days = 30): LinkSummary {
  const ms = (d: string) => Date.parse(`${d}T12:00:00Z`)
  let joined30 = 0, joinedTotal = 0, games = 0, booked = 0
  for (const p of players) {
    if (!p.viaLink) continue
    joinedTotal++; games += p.games; booked += p.booked
    if (p.joined && Math.round((ms(today) - ms(p.joined)) / 86400000) < days) joined30++
  }
  return { joined30, joinedTotal, games, booked: Math.round(booked * 100) / 100 }
}
