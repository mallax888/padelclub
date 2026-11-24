import { splitOn } from '@/lib/club-access'
import { loadTeamCaller } from '@/lib/team-server'
import { covers } from '@/lib/team'
import { isManagerRole } from '@/lib/view-mode'
﻿import { createServerClient } from '@/lib/supabase-server'
import PlayersDirectory from '@/components/players/PlayersDirectory'
import Link from 'next/link'
import { getInitials } from '@/lib/utils'
import { createAdminClient } from '@/lib/supabase-admin'
import { VENUES, getVenue } from '@/lib/venues'
import { currencyForRegion } from '@/lib/currency'
import { loadClubPlayers } from '@/lib/club-players-server'
import ClubPlayers from '@/components/players/ClubPlayers'

export const metadata = { title: 'Players' }

export default async function PlayersPage({ searchParams }: { searchParams?: { venue?: string } }) {
  const supabase = createServerClient()
  // A club's own people see only that club's players. Club accounts are never on a leaderboard.
  const caller = await loadTeamCaller()
  const managing = !!caller && isManagerRole(caller.role)

  let players: any[] = []
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, nickname, member_number, skill_level, skill_rating, membership_tier, ranking_points, wins, losses, role, home_venue_slug')
      .order('member_number', { ascending: true })

    if (!error && data) {
      players = (data as any[]).filter((p: any) => {
        if (managing) return p.role === 'member' && (p.home_venue_slug ? covers(caller!.reach, { kind: 'club', venueSlug: p.home_venue_slug }) : caller!.reach.venueSlug === null && caller!.reach.country === null)
        return splitOn() ? p.role === 'member' : p.role !== 'staff'
      })
    }
  } catch (e) {
    console.error('Players page error:', e)
  }

  // A club's owner or front desk gets a working list of the club's players, with what they have really done there.
  let club: { slug: string; name: string; currency: any; today: string; list: any[]; choices: { slug: string; name: string }[] } | null = null
  if (managing && caller) {
    try {
      const admin = createAdminClient() as any
      const { data: cts } = await admin.from('courts').select('venue_slug').eq('is_active', true)
      const withCourts = new Set(((cts ?? []) as any[]).map(c => c.venue_slug as string))
      const choices = VENUES.filter(v => withCourts.has(v.slug) && covers(caller.reach, { kind: 'club', venueSlug: v.slug })).map(v => ({ slug: v.slug, name: v.name }))
      const slug = choices.find(c => c.slug === searchParams?.venue)?.slug ?? choices[0]?.slug
      if (slug) {
        const v = getVenue(slug)
        const loaded = await loadClubPlayers(admin, slug)
        club = { slug, name: v.name, currency: currencyForRegion(v.region), today: loaded.today, list: loaded.players, choices }
      }
    } catch (e) { console.error('Club players error:', e) }
  }

  const leaderboard = [...players].sort((a, b) => (b.ranking_points ?? 0) - (a.ranking_points ?? 0))

  return (
    <div>
      <div className="mb-6" style={{ userSelect: 'none' }}>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Players</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{managing ? 'Your club\u2019s players, with their stats and ranking' : 'Everyone on PadelMate, with their stats and ranking'}</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">

        {/* Player cards */}
        {club ? (
          <div className="w-full lg:flex-1 min-w-0">
            {club.choices.length > 1 && (
              <div className="flex gap-2 mb-3 overflow-x-auto" data-testid="club-choices">
                {club.choices.map(c => (
                  <Link key={c.slug} href={`/players?venue=${c.slug}`} className="shrink-0 rounded-full px-4 py-2 text-[13px] font-extrabold"
                    style={c.slug === club!.slug ? { background: 'var(--bg-raised)', color: 'var(--text-primary)', border: '1px solid var(--border)' } : { color: 'var(--text-muted)', border: '1px solid var(--border)' }}>{c.name}</Link>
                ))}
              </div>
            )}
            <ClubPlayers players={club.list} today={club.today} venueSlug={club.slug} club={club.name} currency={club.currency} showMoney={caller!.role === 'admin'} canMessage={caller!.role === 'admin'} />
          </div>
        ) : <PlayersDirectory players={players} />}

        {/* Leaderboard — full width on mobile, sidebar on desktop */}
        <div className="w-full lg:w-64 lg:shrink-0 rounded-2xl overflow-hidden"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
          <div className="px-4 py-3 flex items-center justify-between"
            style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-raised)' }}>
            <div className="flex items-center gap-2">
              <span>🏆</span>
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Leaderboard</span>
            </div>
            <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>by pts</div>
          </div>

          {leaderboard.map((player, index) => (
            <Link key={player.id} href={`/players/${player.id}`}>
              <div className="flex items-center gap-3 px-4 py-2.5 transition-colors"
                style={{
                  borderBottom: '1px solid var(--border)',
                  background: index === 0 ? 'var(--brand-primary-muted)' : 'transparent',
                }}>
                <div className="w-5 text-center shrink-0">
                  {index === 0 ? <span className="text-base">🥇</span>
                    : index === 1 ? <span className="text-base">🥈</span>
                    : index === 2 ? <span className="text-base">🥉</span>
                    : <span className="text-xs font-medium" style={{ color: 'var(--text-subtle)' }}>{index + 1}</span>
                  }
                </div>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                  style={{
                    background: index < 3 ? 'var(--brand-primary)' : 'var(--bg-raised)',
                    color: index < 3 ? 'var(--brand-primary-on)' : 'var(--text-muted)',
                    boxShadow: index === 0 ? 'var(--glow-primary)' : 'none',
                    border: '1px solid var(--border)',
                  }}>
                  {getInitials(player.full_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {player.nickname ?? player.full_name ?? 'Unknown'}
                  </div>
                  {player.member_number != null && (
                    <div className="text-[10px]" style={{ color: 'var(--text-subtle)' }}>
                      #{player.member_number}
                    </div>
                  )}
                </div>
                <div className="text-xs font-bold shrink-0" style={{ color: 'var(--brand-primary-text)' }}>
                  {player.ranking_points ?? 0}
                </div>
              </div>
            </Link>
          ))}

          <div className="px-4 py-2 text-center text-[10px]" style={{ color: 'var(--text-subtle)' }}>
            Updates after each match · {leaderboard.length} members
          </div>
        </div>
      </div>
    </div>
  )
}

