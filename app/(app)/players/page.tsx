import { createServerClient } from '@/lib/supabase-server'
import Link from 'next/link'
import { getInitials } from '@/lib/utils'

export default async function PlayersPage() {
  const supabase = createServerClient()

  let players: any[] = []
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, skill_level, membership_tier, ranking_points, wins, losses, role')
      .order('ranking_points', { ascending: false })

    if (!error && data) {
      players = data.filter(p => p.role !== 'staff' && p.role !== 'admin')
    }
  } catch (e) {
    console.error('Players page error:', e)
  }

  return (
    <div>
      <div className="mb-6" style={{ userSelect: 'none' }}>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Players</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>All club members and their stats</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {players.map((player, index) => (
          <Link key={player.id} href={`/players/${player.id}`}>
            <div
              className="rounded-xl p-5 cursor-pointer transition-all hover:scale-[1.01]"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--brand-primary)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center font-medium text-sm shrink-0"
                  style={{ background: 'var(--brand-primary)', color: 'var(--brand-primary-on)', boxShadow: 'var(--glow-primary)' }}
                >
                  {getInitials(player.full_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {player.full_name ?? 'Unknown'}
                  </div>
                  <div className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>
                    {player.skill_level ?? 'beginner'} · {player.membership_tier ?? 'casual'}
                  </div>
                </div>
                {index < 3 && (
                  <div className="text-xl">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg p-2" style={{ background: 'var(--bg-raised)' }}>
                  <div className="text-lg font-semibold" style={{ color: 'var(--brand-primary)' }}>
                    {player.ranking_points ?? 0}
                  </div>
                  <div className="text-[10px]" style={{ color: 'var(--text-subtle)' }}>Points</div>
                </div>
                <div className="rounded-lg p-2" style={{ background: 'var(--bg-raised)' }}>
                  <div className="text-lg font-semibold" style={{ color: '#4DFFEE' }}>
                    {player.wins ?? 0}
                  </div>
                  <div className="text-[10px]" style={{ color: 'var(--text-subtle)' }}>Wins</div>
                </div>
                <div className="rounded-lg p-2" style={{ background: 'var(--bg-raised)' }}>
                  <div className="text-lg font-semibold" style={{ color: '#FF2D78' }}>
                    {player.losses ?? 0}
                  </div>
                  <div className="text-[10px]" style={{ color: 'var(--text-subtle)' }}>Losses</div>
                </div>
              </div>
            </div>
          </Link>
        ))}

        {players.length === 0 && (
          <div className="col-span-3 rounded-xl text-center py-12"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-subtle)' }}>
            No players found
          </div>
        )}
      </div>
    </div>
  )
}
