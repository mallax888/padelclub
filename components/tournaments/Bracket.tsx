import type { BracketRound } from '@/lib/tournament-view'

// The knockout rounds side by side. Winners are bold; a round appears once it has been drawn.
export default function Bracket({ rounds, byes }: { rounds: BracketRound[]; byes: string[] }) {
  if (rounds.length === 0) return null
  return (
    <div data-testid="bracket">
      <div className="sm:overflow-x-auto pb-1">
        <div className="flex flex-col gap-4 sm:flex-row sm:gap-3 sm:min-w-min">
          {rounds.map(r => (
            <div key={r.round} className="w-full sm:w-48 sm:shrink-0 space-y-2" data-testid={`bracket-round-${r.round}`}>
              <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{r.label}</div>
              {r.matches.map(m => (
                <div key={m.id} className="rounded-xl px-3 py-2 text-xs" data-testid={m.third ? 'bracket-third' : 'bracket-match'}
                  style={{ background: 'var(--bg-surface)', border: `1px solid ${m.done ? 'var(--border)' : 'var(--brand-primary)'}` }}>
                  {m.third && <div className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Third place</div>}
                  {([[m.team1, m.score1, m.winner === 1], [m.team2, m.score2, m.winner === 2]] as [string, number | null, boolean][]).map(([name, score, wins], i) => (
                    <div key={i} className="flex justify-between gap-2" style={{ color: wins ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: wins ? 700 : 500, marginTop: i ? 3 : 0 }}>
                      <span className="truncate">{name}</span><span className="tabular-nums">{m.done ? score : ''}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      {byes.length > 0 && <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Straight through to round two: {byes.join(', ')}</p>}
    </div>
  )
}
