'use client'

import { useMemo, useState } from 'react'
import PlayerCard from '@/components/players/PlayerCard'

const SKILL_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'improver', label: 'Improver' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'elite', label: 'Elite' },
]

export default function PlayersDirectory({ players }: { players: any[] }) {
  const [query, setQuery] = useState('')
  const [skillFilter, setSkillFilter] = useState('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return players.filter(p => {
      const matchesQuery = !q || (p.full_name ?? '').toLowerCase().includes(q) || (p.nickname ?? '').toLowerCase().includes(q)
      const matchesSkill = skillFilter === 'all' || (p.skill_level ?? 'beginner') === skillFilter
      return matchesQuery && matchesSkill
    })
  }, [players, query, skillFilter])

  return (
    <div className="w-full lg:flex-1">
      <div className="mb-4 space-y-3">
        <div className="relative">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
          </svg>
          <input
            type="text"
            className="input text-sm"
            style={{ paddingLeft: 34 }}
            placeholder="Search players..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {SKILL_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setSkillFilter(f.value)}
              className="text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
              style={{
                background: skillFilter === f.value ? 'var(--brand-primary)' : 'var(--bg-raised)',
                color: skillFilter === f.value ? 'var(--brand-primary-on)' : 'var(--text-muted)',
                border: `1px solid ${skillFilter === f.value ? 'var(--brand-primary)' : 'var(--border)'}`,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {filtered.map((player) => (
          <PlayerCard key={player.id} player={player} index={players.indexOf(player)} />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-1 sm:col-span-2 rounded-xl text-center py-12"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-subtle)' }}>
            {players.length === 0 ? 'No players found' : 'No players match your search'}
          </div>
        )}
      </div>
    </div>
  )
}
