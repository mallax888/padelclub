import Link from 'next/link'
import { createServerClient } from '@/lib/supabase-server'
import { VENUES } from '@/lib/venues'
import { formatDate } from '@/lib/utils'
import { formatName } from '@/lib/tournament-formats'

export const metadata = { title: 'Tournaments' }

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
    if (status === 'in_progress') return { background: 'var(--brand-primary-muted)', color: 'var(--brand-primary-text)', label: 'Live' }
    if (status === 'completed') return { background: 'var(--bg-raised)', color: 'var(--text-muted)', label: 'Completed' }
    return { background: 'var(--brand-accent-muted)', color: 'var(--brand-accent)', label: 'Draft' }
  }

  return (
    <div>
      <div className="flex flex-col gap-5 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Tournaments</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Tournament days at your club: Americano, round robin, groups and knockouts</p>
        </div>
        {isStaff && (
          <Link href="/tournaments/new" className="btn-main" data-testid="new-tournament">+ New tournament</Link>
        )}
      </div>

      {(tournaments ?? []).length === 0 ? (
        isStaff ? (
          <div className="rounded-2xl text-center py-12 text-sm" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            No tournaments yet — create one to get started
          </div>
        ) : (
          // A player with nothing here yet: say what will appear, and give them something to do now.
          <div className="rounded-[20px] text-center px-5 py-7" data-testid="empty-tournaments" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="text-[30px] leading-none" aria-hidden>🏆</div>
            <div className="text-[17px] font-extrabold mt-2.5" style={{ color: 'var(--text-primary)' }}>No tournaments yet</div>
            <p className="text-[13.5px] mt-1.5 mb-4 mx-auto max-w-[280px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>When your club runs an Americano or a knockout, it shows up here and you can sign up.</p>
            <Link href="/book" className="btn-main btn-main-lime inline-flex w-auto px-6">Book a court →</Link>
          </div>
        )
      ) : (
        <div className="space-y-3">
          {(tournaments ?? []).map(t => {
            const venue = VENUES.find(v => v.slug === t.venue_slug)
            const s = statusStyle(t.status)
            return (
              <Link key={t.id} href={`/tournaments/${t.id}`}
                className="flex items-center justify-between rounded-2xl p-4 transition-all hover:scale-[1.005]"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
                <div className="min-w-0">
                  <div className="text-[15px]" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display), Manrope, sans-serif', fontWeight: 500 }}>{t.name}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {formatName(t.format)} · {venue?.name ?? t.venue_slug} · {formatDate(t.date)}
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
