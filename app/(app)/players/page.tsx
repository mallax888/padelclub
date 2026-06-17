import { createServerClient } from '@/lib/supabase-server'
import PlayerCard from '@/components/players/PlayerCard'
import Link from 'next/link'
import { getInitials } from '@/lib/utils'

export default async function PlayersPage() {
  const supabase = createServerClient()

  let players: any[] = []
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, nickname, member_number, skill_level, membership_tier, ranking_points, wins, losses, role')
      .order('member_number', { ascending: true })

    if (!error && data) {
      players = (data as any[]).filter((p: any) => p.role !== 'staff' && p.role !== 'admin')
    }
  } catch (e) {
    console.error('Players page error:', e)
  }

  const leaderboard = [...players].sort((a, b) => (b.ranking_points ?? 0) - (a.ranking_points ?? 0))

  return (
    <div>
      <div className="mb-6" style={{ userSelect: 'none' }}>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Players</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>All club members and their stats</p>
      </div>

      <div className="flex gap-6 items-start">

        {/* Player cards — main, 2 col grid */}
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {players.map((player, index) => (
            <PlayerCard key={player.id} player={player} index={index} />
          ))}
          {players.length === 0 && (
            <div className="col-span-2 rounded-xl text-center py-12"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-subtle)' }}>
              No players found
            </div>
          )}
        </div>

        {/* Leaderboard — sticky sidebar */}
        <div className="w-64 shrink-0 sticky top-20 rounded-xl overflow-hidden"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>

          {/* Header */}
          <div className="px-4 py-3 flex items-center justify-between"
            style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-raised)' }}>
            <div className="flex items-center gap-2">
              <span>🏆</span>
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Leaderboard</span>
            </div>
            <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>by pts</div>
          </div>

          {/* All players ranked */}
          {leaderboard.map((player, index) => (
            <Link key={player.id} href={`/players/${player.id}`}>
              <div
                className="flex items-center gap-3 px-4 py-2.5 transition-colors"
                style={{
                  borderBottom: '1px solid var(--border)',
                  background: index === 0 ? 'var(--brand-primary-muted)' : 'transparent',
                }}
              >
                {/* Rank */}
                <div className="w-5 text-center shrink-0">
                  {index === 0 ? <span className="text-base">🥇</span>
                    : index === 1 ? <span className="text-base">🥈</span>
                    : index === 2 ? <span className="text-base">🥉</span>
                    : <span className="text-xs font-medium" style={{ color: 'var(--text-subtle)' }}>{index + 1}</span>
                  }
                </div>

                {/* Avatar */}
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                  style={{
                    background: index < 3 ? 'var(--brand-primary)' : 'var(--bg-raised)',
                    color: index < 3 ? 'var(--brand-primary-on)' : 'var(--text-muted)',
                    boxShadow: index === 0 ? 'var(--glow-primary)' : 'none',
                    border: '1px solid var(--border)',
                  }}
                >
                  {getInitials(player.full_name)}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {player.nickname ?? player.full_name ?? 'Unknown'}
                  </div>
                  <div className="text-[10px]" style={{ color: 'var(--text-subtle)' }}>
                    #{player.member_number}
                  </div>
                </div>

                {/* Points */}
                <div className="text-xs font-bold shrink-0" style={{ color: 'var(--brand-primary)' }}>
                  {player.ranking_points ?? 0}
                </div>
              </div>
            </Link>
          ))}

          {leaderboard.length === 0 && (
            <div className="px-4 py-8 text-center text-xs" style={{ color: 'var(--text-subtle)' }}>
              No players yet
            </div>
          )}

          <div className="px-4 py-2 text-center text-[10px]" style={{ color: 'var(--text-subtle)' }}>
            Updates after each match
          </div>
        </div>

      </div>
    </div>
  )
}
