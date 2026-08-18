import Link from 'next/link'
import { createServerClient } from '@/lib/supabase-server'
import { VENUES } from '@/lib/venues'
import { formatDate } from '@/lib/utils'

export default async function TournamentsPage() {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', session!.user.id).single()
  const isStaff = profile?.role === 'staff' || profile?.role === 'admin'

  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('*')
    .order('date', { ascending: false })

  const statusStyle = (status: string) => {
    if (status === 'in_progress') return { background: 'var(--brand-primary-muted)', color: 'var(--brand-primary)', label: 'Live' }
    if (status === 'completed') return { background: 'var(--bg-raised)', color: 'var(--text-muted)', label: 'Completed' }
    return { background: 'var(--brand-accent-muted)', color: 'var(--brand-accent)', label: 'Draft' }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Tournaments</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Americano & Mexicano tournament days at your club</p>
        </div>
        {isStaff && (
          <Link href="/tournaments/new" className="btn btn-primary">+ New tournament</Link>
        )}
      </div>

      {(tournaments ?? []).length === 0 ? (
        <div className="rounded-2xl text-center py-12 text-sm" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          No tournaments yet{isStaff ? ' — create one to get started' : ''}
        </div>
      ) : (
        <div className="space-y-3">
          {(tournaments ?? []).map(t => {
            const venue = VENUES.find(v => v.slug === t.venue_slug)
            const s = statusStyle(t.status)
            return (
              <Link key={t.id} href={`/tournaments/${t.id}`}
                className="flex items-center justify-between rounded-2xl p-4 transition-all hover:scale-[1.005]"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <div className="min-w-0">
                  <div className="font-extrabold text-sm" style={{ color: 'var(--text-primary)' }}>{t.name}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {t.format === 'mexicano' ? 'Mexicano' : 'Americano'} · {venue?.name ?? t.venue_slug} · {formatDate(t.date)}
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full shrink-0" style={{ background: s.background, color: s.color }}>{s.label}</span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
