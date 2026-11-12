import type { TableRow } from '@/lib/tournament-view'

// A league table: win 3 points, draw 1. Rows that go through to the knockout are marked.
export default function StandingsTable({ title, rows, testId }: { title?: string; rows: TableRow[]; testId?: string }) {
  return (
    <div className="rounded-2xl p-4" data-testid={testId} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
      {title && <h2 className="text-sm font-extrabold uppercase tracking-wide mb-3" style={{ color: 'var(--text-primary)' }}>{title}</h2>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              <th className="text-left font-bold pb-1.5 w-6">#</th><th className="text-left font-bold pb-1.5">Pair</th>
              <th className="font-bold pb-1.5 px-1.5">P</th><th className="font-bold pb-1.5 px-1.5">W</th><th className="font-bold pb-1.5 px-1.5">D</th><th className="font-bold pb-1.5 px-1.5">L</th>
              <th className="font-bold pb-1.5 px-1.5">+/-</th><th className="font-bold pb-1.5 pl-1.5 text-right">Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} data-testid="table-row" style={{ color: 'var(--text-primary)' }}>
                <td className="py-1 font-bold" style={{ color: r.qualifies ? 'var(--brand-green)' : i < 3 ? 'var(--brand-primary-text)' : 'var(--text-muted)' }}>{r.rank || i + 1}</td>
                <td className="py-1 font-medium">{r.name}{r.qualifies && <span className="ml-2 text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--brand-green)' }}>through</span>}</td>
                <td className="text-center px-1.5">{r.played}</td><td className="text-center px-1.5">{r.won}</td><td className="text-center px-1.5">{r.drawn}</td><td className="text-center px-1.5">{r.lost}</td>
                <td className="text-center px-1.5">{r.diff > 0 ? `+${r.diff}` : r.diff}</td><td className="text-right pl-1.5 font-bold">{r.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
