const fs = require('fs');

fs.writeFileSync('app/(app)/players/[id]/page.tsx', `import { createServerClient } from '@/lib/supabase-server'
import { getInitials, formatDate } from '@/lib/utils'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import NicknameEditor from '@/components/players/NicknameEditor'
import SkillEditor from '@/components/players/SkillEditor'

export default async function PlayerDetailPage({ params }: { params: { id: string } }) {
  const supabase = createServerClient()

  const { data, error } = await supabase.from('profiles').select('*').eq('id', params.id).single()
  if (error || !data) notFound()

  const player = data as any
  const { data: { session } } = await supabase.auth.getSession()
  const isOwnProfile = session?.user?.id === params.id

  // Fetch matches where this player participated
  const { data: matchesData } = await supabase
    .from('matches')
    .select(\`
      id, score, winner_team, played_at, notes,
      team1_player1:profiles!matches_team1_player1_id_fkey(id, full_name, nickname),
      team1_player2:profiles!matches_team1_player2_id_fkey(id, full_name, nickname),
      team2_player1:profiles!matches_team2_player1_id_fkey(id, full_name, nickname),
      team2_player2:profiles!matches_team2_player2_id_fkey(id, full_name, nickname)
    \`)
    .or(\`team1_player1_id.eq.\${params.id},team1_player2_id.eq.\${params.id},team2_player1_id.eq.\${params.id},team2_player2_id.eq.\${params.id}\`)
    .order('played_at', { ascending: false })
    .limit(20)

  const matches = (matchesData ?? []) as any[]

  // Calculate win rate
  const totalMatches = matches.length
  const wins = player.wins ?? 0
  const losses = player.losses ?? 0
  const winRate = totalMatches > 0 ? Math.round((wins / (wins + losses)) * 100) : 0

  // Head to head — count opponents and results
  const h2h: Record<string, { name: string; wins: number; losses: number; id: string }> = {}
  for (const m of matches) {
    const onTeam1 = [m.team1_player1?.id, m.team1_player2?.id].includes(params.id)
    const won = (onTeam1 && m.winner_team === 1) || (!onTeam1 && m.winner_team === 2)
    const opponents = onTeam1
      ? [m.team2_player1, m.team2_player2].filter(Boolean)
      : [m.team1_player1, m.team1_player2].filter(Boolean)
    for (const opp of opponents) {
      if (!opp?.id) continue
      if (!h2h[opp.id]) h2h[opp.id] = { name: opp.nickname ?? opp.full_name ?? 'Unknown', wins: 0, losses: 0, id: opp.id }
      if (won) h2h[opp.id].wins++
      else h2h[opp.id].losses++
    }
  }
  const h2hList = Object.values(h2h).sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses)).slice(0, 5)

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/players" className="inline-flex items-center gap-1.5 text-sm mb-6 transition-colors"
        style={{ color: 'var(--text-muted)' }}>
        ← Back to players
      </Link>

      {/* Profile header */}
      <div className="rounded-xl p-6 mb-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-semibold shrink-0"
              style={{ background: 'var(--brand-primary)', color: 'var(--brand-primary-on)', boxShadow: 'var(--glow-primary)' }}>
              {getInitials(player.full_name)}
            </div>
            <div className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full text-xs font-bold"
              style={{ background: 'var(--bg-base)', color: 'var(--brand-primary)', border: '1px solid var(--brand-primary)' }}>
              #{player.member_number}
            </div>
          </div>
          <div className="flex-1">
            <div className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              {player.nickname ?? player.full_name}
            </div>
            {player.nickname && (
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{player.full_name}</div>
            )}
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="text-xs px-2.5 py-1 rounded-full capitalize"
                style={{ background: 'var(--brand-primary-muted)', color: 'var(--brand-primary)' }}>
                {player.membership_tier ?? 'casual'}
              </span>
              <span className="text-xs px-2.5 py-1 rounded-full capitalize"
                style={{ background: 'var(--bg-raised)', color: 'var(--text-muted)' }}>
                {player.skill_level ?? 'beginner'}
              </span>
            </div>
            {isOwnProfile && (
              <div className="flex flex-col gap-1 mt-1">
                <NicknameEditor userId={player.id} currentNickname={player.nickname} />
                <SkillEditor userId={player.id} currentSkillLevel={player.skill_level} />
              </div>
            )}
          </div>
        </div>
        {player.bio && (
          <p className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>{player.bio}</p>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Points',   value: player.ranking_points ?? 0, color: 'var(--brand-primary)' },
          { label: 'Wins',     value: wins,                        color: 'var(--brand-primary)' },
          { label: 'Losses',   value: losses,                      color: 'var(--brand-accent)' },
          { label: 'Win rate', value: winRate + '%',               color: 'var(--text-primary)' },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl p-4 text-center"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="text-2xl font-semibold" style={{ color: stat.color }}>{stat.value}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Head to head */}
      {h2hList.length > 0 && (
        <div className="rounded-xl p-5 mb-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Head to head</div>
          <div className="space-y-2">
            {h2hList.map(opp => {
              const total = opp.wins + opp.losses
              const pct = Math.round((opp.wins / total) * 100)
              return (
                <Link key={opp.id} href={\`/players/\${opp.id}\`}>
                  <div className="flex items-center gap-3 py-2 rounded-lg px-2 transition-colors"
                    style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={undefined}>
                    <div className="flex-1 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{opp.name}</div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold" style={{ color: 'var(--brand-primary)' }}>{opp.wins}W</span>
                      <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>–</span>
                      <span className="text-xs font-semibold" style={{ color: 'var(--brand-accent)' }}>{opp.losses}L</span>
                      <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-raised)' }}>
                        <div className="h-full rounded-full" style={{ width: pct + '%', background: 'var(--brand-primary)' }} />
                      </div>
                      <span className="text-xs w-8 text-right" style={{ color: 'var(--text-muted)' }}>{pct}%</span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Match history */}
      {matches.length > 0 && (
        <div className="rounded-xl p-5 mb-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Match history</div>
          <div className="space-y-2">
            {matches.map(m => {
              const onTeam1 = [m.team1_player1?.id, m.team1_player2?.id].includes(params.id)
              const won = (onTeam1 && m.winner_team === 1) || (!onTeam1 && m.winner_team === 2)
              const partners = onTeam1
                ? [m.team1_player1, m.team1_player2].filter((p: any) => p?.id !== params.id)
                : [m.team2_player1, m.team2_player2].filter((p: any) => p?.id !== params.id)
              const opponents = onTeam1
                ? [m.team2_player1, m.team2_player2].filter(Boolean)
                : [m.team1_player1, m.team1_player2].filter(Boolean)
              return (
                <div key={m.id} className="flex items-center gap-3 py-2"
                  style={{ borderBottom: '1px solid var(--border)' }}>
                  <div className="w-12 text-xs font-bold text-center px-1.5 py-0.5 rounded-lg shrink-0"
                    style={{ background: won ? 'var(--brand-primary-muted)' : 'var(--brand-accent-muted)', color: won ? 'var(--brand-primary)' : 'var(--brand-accent)' }}>
                    {won ? 'WIN' : 'LOSS'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                      {m.score}
                    </div>
                    <div className="text-[10px] truncate" style={{ color: 'var(--text-subtle)' }}>
                      vs {opponents.map((o: any) => o?.nickname ?? o?.full_name ?? '?').join(' & ')}
                      {partners.length > 0 && \` · with \${partners.map((p: any) => p?.nickname ?? p?.full_name ?? '?').join(' & ')}\`}
                    </div>
                  </div>
                  <div className="text-[10px] shrink-0" style={{ color: 'var(--text-subtle)' }}>
                    {m.played_at ? new Date(m.played_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' }) : ''}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Player details */}
      <div className="rounded-xl p-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <div className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Player details</div>
        {[
          ['Member number', \`#\${player.member_number}\`],
          ['Skill level', player.skill_level ? player.skill_level.charAt(0).toUpperCase() + player.skill_level.slice(1) : 'Beginner'],
          ['Favourite court', player.favourite_court ?? '—'],
          ['Member since', player.created_at?.slice(0, 10) ?? '—'],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between py-2 text-sm"
            style={{ borderBottom: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--text-muted)' }}>{label}</span>
            <span style={{ color: 'var(--text-primary)' }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
`, 'utf8');

console.log('Done');
