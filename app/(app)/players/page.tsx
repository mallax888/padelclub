import { createServerClient } from '@/lib/supabase-server'
import PlayerCard from '@/components/players/PlayerCard'

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

  return (
    <div>
      <div className="mb-6" style={{ userSelect: 'none' }}>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Players</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>All club members and their stats</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {players.map((player, index) => (
          <PlayerCard key={player.id} player={player} index={index} />
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
