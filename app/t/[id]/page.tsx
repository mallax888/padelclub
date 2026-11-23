import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase-admin'
import { loadShared } from '@/lib/share-server'

export const dynamic = 'force-dynamic'

// The public, read-only leaderboard behind a tournament's Share button. Anyone with the link can look; it shows
// names (first name and last initial) and scores, nothing else.
export async function generateMetadata({ params }: { params: { id: string } }) {
  const s = await loadShared(createAdminClient() as any, params.id)
  if (!s) return { title: 'Tournament | PadelMate' }
  const title = `${s.name} · ${s.club}`
  return { title: `${title} | PadelMate`, description: `${s.summary.heading}: ${s.summary.detail}`, openGraph: { title, description: `${s.summary.heading}. ${s.summary.detail}`, images: [`/t/${params.id}/card`] }, twitter: { card: 'summary_large_image' as const, title, images: [`/t/${params.id}/card`] } }
}

export default async function SharedTournament({ params }: { params: { id: string } }) {
  const s = await loadShared(createAdminClient() as any, params.id)
  if (!s) notFound()
  return (
    <main className="min-h-screen px-4 py-8" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <div className="mx-auto w-full" style={{ maxWidth: 560 }}>
        <div className="text-[11px] font-extrabold uppercase" style={{ letterSpacing: '0.14em', color: 'var(--text-subtle)' }}>{s.club}</div>
        <h1 className="text-3xl font-semibold mt-1" data-testid="shared-title">{s.name}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{s.date} · {s.summary.detail}</p>
        <span className="inline-block mt-3 text-[10.5px] font-bold uppercase px-2.5 py-1 rounded-full" style={{ letterSpacing: '0.06em', background: s.live ? 'var(--brand-primary-muted)' : 'var(--bg-raised)', color: s.live ? 'var(--brand-primary-text)' : 'var(--text-muted)' }}>{s.live ? 'Live' : s.summary.finished ? 'Finished' : 'Not started'}</span>

        <div className="rounded-[20px] p-5 mt-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }} data-testid="shared-board">
          <div className="text-[11px] font-extrabold uppercase mb-3" style={{ letterSpacing: '0.14em', color: 'var(--text-subtle)' }}>{s.summary.heading}</div>
          {s.summary.rows.length > 0 ? (
            <ol className="space-y-2">
              {s.summary.rows.map(r => (
                <li key={r.rank} className="flex items-center gap-3 text-base" style={{ fontWeight: r.rank === 1 ? 800 : 600 }}>
                  <span className="w-6 text-center" style={{ color: 'var(--brand-primary-text)' }}>{r.rank}</span><span className="flex-1">{r.name}</span>{r.score !== null && <span className="tabular-nums">{r.score}</span>}
                </li>
              ))}
            </ol>
          ) : <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No scores yet. Check back soon.</p>}
        </div>

        {s.rotation && s.players.length > 0 && s.summary.rows.length > 0 && (
          <div className="rounded-[20px] p-5 mt-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="text-[11px] font-extrabold uppercase mb-3" style={{ letterSpacing: '0.14em', color: 'var(--text-subtle)' }}>Everyone</div>
            <table className="w-full text-sm tabular-nums"><thead><tr className="text-[10px] uppercase" style={{ color: 'var(--text-muted)' }}><th className="text-left pb-1.5">Player</th><th className="pb-1.5">Played</th><th className="pb-1.5">Won</th><th className="text-right pb-1.5">Pts</th></tr></thead>
              <tbody>{s.players.map((p, i) => <tr key={i}><td className="py-1 font-medium">{p.name}</td><td className="text-center">{p.played}</td><td className="text-center">{p.won}</td><td className="text-right font-bold">{p.points}</td></tr>)}</tbody></table>
          </div>
        )}
        <p className="text-xs mt-6 text-center" style={{ color: 'var(--text-subtle)' }}>Made with PadelMate · padelclub-nz.vercel.app</p>
      </div>
    </main>
  )
}
