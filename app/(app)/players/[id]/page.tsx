import { createServerClient } from '@/lib/supabase-server'
import { getInitials } from '@/lib/utils'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import NicknameEditor from '@/components/players/NicknameEditor'

export default async function PlayerDetailPage({ params }: { params: { id: string } }) {
  const supabase = createServerClient()

  const { data: player, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !player) notFound()

  const { data: { session } } = await supabase.auth.getSession()
  const isOwnProfile = session?.user?.id === params.id

  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, date, start_time, status')
    .eq('user_id', params.id)
    .eq('status', 'confirmed')
    .order('date', { ascending: false })
    .limit(5)

  const totalBookings = bookings?.length ?? 0

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/players" className="inline-flex items-center gap-1.5 text-sm mb-6 transition-colors"
        style={{ color: 'var(--text-muted)' }}>
        ← Back to players
      </Link>

      <div className="rounded-xl p-6 mb-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-5">
          <div className="relative">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-semibold shrink-0"
              style={{ background: 'var(--brand-primary)', color: 'var(--brand-primary-on)', boxShadow: 'var(--glow-primary)' }}
            >
              {getInitials(player.full_name)}
            </div>
            <div
              className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full text-xs font-bold"
              style={{ background: 'var(--bg-base)', color: 'var(--brand-primary)', border: '1px solid var(--brand-primary)' }}
            >
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
              <NicknameEditor userId={player.id} currentNickname={player.nickname} />
            )}
          </div>
        </div>
        {player.bio && (
          <p className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>{player.bio}</p>
        )}
      </div>

      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Points',   value: player.ranking_points ?? 0, color: 'var(--brand-primary)' },
          { label: 'Wins',     value: player.wins ?? 0,           color: '#4DFFEE' },
          { label: 'Losses',   value: player.losses ?? 0,         color: '#FF2D78' },
          { label: 'Bookings', value: totalBookings,              color: 'var(--text-primary)' },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl p-4 text-center"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="text-2xl font-semibold" style={{ color: stat.color }}>{stat.value}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl p-5 mb-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <div className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Player details</div>
        {[
          ['Member number', `#${player.member_number}`],
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

      {bookings && bookings.length > 0 && (
        <div className="rounded-xl p-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Recent bookings</div>
          {bookings.map(b => (
            <div key={b.id} className="flex justify-between py-2 text-sm"
              style={{ borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-muted)' }}>{b.date}</span>
              <span style={{ color: 'var(--text-primary)' }}>{b.start_time?.slice(0, 5)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
