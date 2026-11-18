import { keepClubAccountsOut } from '@/lib/club-guard'
import { createServerClient } from '@/lib/supabase-server'
import { loadOpenOffers } from '@/lib/offers'
import { VENUES } from '@/lib/venues'
import { timezoneForVenueSlug } from '@/lib/timezone'
import { rankForYou, type GameLite } from '@/lib/matchmaking'
import { distinctPeople, monthSummary, nextGame, savedLast30, shareSummary, usualOf, type HomeBooking } from '@/lib/home-rules'
import HomeView from '@/components/home/HomeView'

export const metadata = { title: 'Home' }

// The first screen a player sees: what is coming up, one tap to book their usual, and the games
// and deals that suit them. Everything here is read-only; each card links to where it is done.
export default async function HomePage() {
  const supabase = createServerClient()
  await keepClubAccountsOut(supabase, '/home')
  const { data: { session } } = await supabase.auth.getSession()
  const userId = session!.user.id
  const nowMs = Date.now()

  const [{ data: bookingRows }, { data: profile }] = await Promise.all([
    supabase.from('bookings').select('*, courts(*)').eq('user_id', userId).order('date', { ascending: true }).order('start_time', { ascending: true }),
    supabase.from('profiles').select('full_name, nickname, home_venue_slug, skill_rating').eq('id', userId).maybeSingle(),
  ])
  const bookings = ((bookingRows ?? []) as any[]) as (HomeBooking & Record<string, any>)[]
  const next = nextGame(bookings, nowMs)
  const usual = usualOf(bookings, nowMs)
  const saved = savedLast30(bookings, nowMs)

  // Who has paid their share of the next game (only the booker can read these rows).
  let shares = { paid: [] as string[], waiting: [] as string[] }
  if (next) {
    const { data: rows } = await supabase
      .from('booking_splits')
      .select('status, profiles!booking_splits_user_id_fkey(nickname, full_name)')
      .eq('booking_id', next.id)
      .eq('invited_by', userId)
    shares = shareSummary(((rows ?? []) as any[]).map(r => ({ status: r.status as string, name: (r.profiles?.nickname ?? r.profiles?.full_name?.split(' ')[0] ?? 'A friend') as string })))
  }

  // Who they have shared a court with: friends who joined their bookings, and the others in the open games they played.
  const [{ data: paidSplits }, { data: myGames }] = await Promise.all([
    supabase.from('booking_splits').select('user_id').eq('invited_by', userId).eq('status', 'paid'),
    supabase.from('open_match_players').select('match_id').eq('player_id', userId).eq('status', 'accepted'),
  ])
  const matchIds = ((myGames ?? []) as any[]).map(r => r.match_id).filter(Boolean) as string[]
  const { data: mates } = matchIds.length
    ? await supabase.from('open_match_players').select('player_id').in('match_id', matchIds).eq('status', 'accepted')
    : { data: [] as any[] }
  const people = distinctPeople([...((paidSplits ?? []) as any[]).map(r => r.user_id), ...((mates ?? []) as any[]).map(r => r.player_id)], userId)

  // Games that fit this player's level, evenly matched first, home club ahead of the rest.
  const homeSlug: string | null = (profile as any)?.home_venue_slug ?? null
  const rating = (profile as any)?.skill_rating
  const viewerRating = rating !== null && rating !== undefined && Number.isFinite(Number(rating)) ? Number(rating) : null
  const cutoff = new Date(nowMs - 24 * 3600 * 1000).toISOString().slice(0, 10)
  const { data: matchRows } = await supabase
    .from('open_matches')
    .select('*, courts(name, type), open_match_players(id, player_id, status, profiles(id, skill_rating))')
    .eq('visibility', 'public').in('status', ['open', 'full']).gte('date', cutoff)
    .order('date', { ascending: true }).order('start_time', { ascending: true })
  const games = rankForYou(((matchRows ?? []) as any[]).map(m => {
    const players = (m.open_match_players ?? []) as any[]
    const accepted = players.filter(p => p.status === 'accepted')
    return {
      id: m.id, date: m.date, start_time: m.start_time, venue_slug: m.venue_slug, skill_min: Number(m.skill_min), skill_max: Number(m.skill_max),
      spotsLeft: m.spots_total - accepted.length, spotsTotal: m.spots_total, filled: accepted.length,
      ratings: accepted.map(p => Number(p.profiles?.skill_rating)).filter(r => Number.isFinite(r)),
      mine: m.organizer_id === userId || players.some(p => p.player_id === userId),
    } as GameLite & { spotsTotal: number; filled: number }
  }), viewerRating, homeSlug, 3)

  // A deal open right now: at the home club if there is one, else the newest.
  const offers = await loadOpenOffers(supabase as any, nowMs)
  const mineOffers = offers.filter(o => o.venue_slug === homeSlug)
  const offer = (mineOffers.length ? mineOffers : offers).slice().sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))[0] ?? null

  const tz = timezoneForVenueSlug(homeSlug ?? next?.courts?.venue_slug ?? VENUES[0].slug)
  const localToday = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(nowMs))
  const m = monthSummary(bookings, nowMs, localToday)
  const month = m.games > 0 || m.weeks > 0 || people > 0 ? { games: m.games, people, weeks: m.weeks } : null
  const first = ((profile as any)?.nickname ?? (profile as any)?.full_name ?? '').toString().split(' ')[0] || null
  return <HomeView name={first} homeSlug={homeSlug} tz={tz} nowMs={nowMs} next={next as any} shares={shares} usual={usual} games={games as any} offer={offer as any} saved={saved} month={month} />
}
