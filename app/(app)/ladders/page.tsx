import Link from 'next/link'
import { createServerClient } from '@/lib/supabase-server'

export default async function LaddersPage() {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', session!.user.id).single()
  const isStaff = profile?.role === 'staff' || profile?.role === 'admin'

  const { data: ladders } = await supabase
    .from('ladders')
    .select('*, ladder_entries(count)')
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Ladders</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Challenge players above you and climb the club ranking</p>
        </div>
        {isStaff && (
          <Link href="/ladders/new" className="btn btn-primary">+ New ladder</Link>
        )}
      </div>

      {(ladders ?? []).length === 0 ? (
        <div className="rounded-2xl text-center py-12 text-sm" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          No ladders yet{isStaff ? ' — create one to get started' : ''}
        </div>
      ) : (
        <div className="space-y-3">
          {(ladders ?? []).map((l: any) => {
            const playerCount = l.ladder_entries?.[0]?.count ?? 0
            const archived = l.status === 'archived'
            return (
              <Link key={l.id} href={`/ladders/${l.id}`}
                className="flex items-center justify-between rounded-2xl p-4 transition-all hover:scale-[1.005]"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)', opacity: archived ? 0.72 : 1 }}>
                <div className="min-w-0">
                  <div className="text-[15px]" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display), Manrope, sans-serif', fontWeight: 500 }}>{l.name}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {playerCount} {playerCount === 1 ? 'player' : 'players'} · challenge up to {l.max_challenge_gap} spots above you
                  </div>
                </div>
                {archived && (
                  <span className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full shrink-0" style={{ background: 'var(--bg-raised)', color: 'var(--text-muted)' }}>Archived</span>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
