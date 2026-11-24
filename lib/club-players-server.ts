// Server-only: reads a club's players with what they have really done there (games, last played, what they booked, what they owe).
// Everything comes from bookings and shares already in the database. Only call this after checking the caller is an owner or
// front desk whose reach covers the club.
import { homeClubIds } from '@/lib/offers'
import { gameHasEnded } from '@/lib/game-over'
import { timezoneForVenueSlug } from '@/lib/timezone'
import { tierLabel } from '@/lib/plan-rules'
import type { ClubPlayer } from '@/lib/club-players'

type Admin = any
const chunks = <T,>(a: T[], n: number): T[][] => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n))
const dayIn = (tz: string, ms: number) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms))

export async function loadClubPlayers(admin: Admin, venueSlug: string, nowMs: number = Date.now()): Promise<{ today: string; players: ClubPlayer[] }> {
  const today = dayIn(timezoneForVenueSlug(venueSlug), nowMs)
  const { data: courts } = await admin.from('courts').select('id').eq('venue_slug', venueSlug)
  const courtIds = ((courts ?? []) as any[]).map(c => c.id as string)
  const { data: bk } = courtIds.length
    ? await admin.from('bookings').select('id, user_id, date, start_time, end_time, price_nzd, status').in('court_id', courtIds).in('status', ['confirmed', 'completed'])
    : { data: [] as any[] }
  const bookings = (bk ?? []) as any[]
  const ids = new Set<string>(await homeClubIds(admin, venueSlug))
  for (const b of bookings) if (b.user_id) ids.add(b.user_id)

  const profiles: any[] = []
  for (const part of chunks(Array.from(ids), 150)) {
    const { data } = await admin.from('profiles').select('id, full_name, nickname, membership_tier, role, created_at').in('id', part)
    profiles.push(...((data ?? []) as any[]))
  }

  // Which of them came in through this club's booking link. Read on its own so the page still works
  // before the database change that adds the column has been run.
  const viaLink = new Set<string>()
  const { data: via, error: viaErr } = await admin.from('profiles').select('id').eq('joined_via_venue', venueSlug)
  if (!viaErr) for (const r of ((via ?? []) as any[])) viaLink.add(r.id)

  const stats = new Map<string, { last: string | null; games: number; booked: number }>()
  const upcoming = new Set<string>() // bookings still to be played, the only ones a share can still be owed on
  for (const b of bookings) {
    const ended = gameHasEnded(b.date, b.end_time ?? b.start_time, venueSlug, nowMs)
    if (!ended) { upcoming.add(b.id); continue }
    if (!b.user_id) continue
    const s = stats.get(b.user_id) ?? { last: null, games: 0, booked: 0 }
    s.games += 1; s.booked += Number(b.price_nzd) || 0
    if (!s.last || b.date > s.last) s.last = b.date
    stats.set(b.user_id, s)
  }

  const owes = new Map<string, number>()
  for (const part of chunks(Array.from(upcoming), 150)) {
    const { data } = await admin.from('booking_splits').select('user_id, booking_id, status').in('booking_id', part).eq('status', 'pending')
    for (const s of ((data ?? []) as any[])) if (s.user_id) owes.set(s.user_id, (owes.get(s.user_id) ?? 0) + 1)
  }

  const players: ClubPlayer[] = profiles.filter(p => p.role === 'member').map(p => {
    const s = stats.get(p.id)
    const tier = (p.membership_tier ?? 'casual') as string
    return {
      id: p.id, name: (p.nickname || p.full_name || 'Player') as string, member: tier !== 'casual', planLabel: tier !== 'casual' ? tierLabel(tier) : null,
      lastPlayed: s?.last ?? null, games: s?.games ?? 0, booked: Math.round((s?.booked ?? 0) * 100) / 100, owes: owes.get(p.id) ?? 0,
      viaLink: viaLink.has(p.id),
      joined: p.created_at ? dayIn(timezoneForVenueSlug(venueSlug), Date.parse(p.created_at)) : null,
    }
  })
  return { today, players }
}
