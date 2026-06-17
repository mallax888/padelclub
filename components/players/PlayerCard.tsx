'use client'

import Link from 'next/link'
import { getInitials } from '@/lib/utils'

export default function PlayerCard({ player, index }: { player: any; index: number }) {
  return (
    <Link href={`/players/${player.id}`}>
      <div
        className="rounded-xl p-5 cursor-pointer transition-all hover:scale-[1.01]"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--brand-primary)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="relative">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center font-medium text-sm shrink-0"
              style={{ background: 'var(--brand-primary)', color: 'var(--brand-primary-on)', boxShadow: 'var(--glow-primary)' }}
            >
              {getInitials(player.full_name)}
            </div>
            <div
              className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold"
              style={{ background: 'var(--bg-base)', color: 'var(--text-subtle)', border: '1px solid var(--border)' }}
            >
              {player.member_number}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>
              {player.nickname ?? player.full_name ?? 'Unknown'}
            </div>
            {player.nickname && (
              <div className="text-xs truncate" style={{ color: 'var(--text-subtle)' }}>
                {player.full_name}
              </div>
            )}
            <div className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>
              #{player.member_number} · {player.skill_level ?? 'beginner'} · {player.membership_tier ?? 'casual'}
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
  )
}
