import { createServerClient } from '@/lib/supabase-server'
import Link from 'next/link'
import { getInitials } from '@/lib/utils'

export default async function PlayersPage() {
  const supabase = createServerClient()

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'member')
    .order('ranking_points', { ascending: false })

  const players = (data ?? []) as any[]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Players</h1>
        <p className="text-sm text-gray-500 mt-1">All club members and their stats</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {players.map((player, index) => (
          <Link key={player.id} href={`/players/${player.id}`}>
            <div className="card hover:border-brand-400 transition-all cursor-pointer">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-brand-400 text-white flex items-center justify-center font-medium text-sm shrink-0">
                  {getInitials(player.full_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{player.full_name ?? 'Unknown'}</div>
                  <div className="text-xs text-gray-400 capitalize">{player.skill_level ?? 'beginner'} · {player.membership_tier}</div>
                </div>
                {index < 3 && (
                  <div className="text-xl">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="text-lg font-semibold text-brand-600">{player.ranking_points ?? 0}</div>
                  <div className="text-[10px] text-gray-400">Points</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="text-lg font-semibold text-green-600">{player.wins ?? 0}</div>
                  <div className="text-[10px] text-gray-400">Wins</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="text-lg font-semibold text-red-500">{player.losses ?? 0}</div>
                  <div className="text-[10px] text-gray-400">Losses</div>
                </div>
              </div>
            </div>
          </Link>
        ))}

        {players.length === 0 && (
          <div className="col-span-3 card text-center py-12 text-gray-400">
            No players yet
          </div>
        )}
      </div>
    </div>
  )
}