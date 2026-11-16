import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase-admin'
import { loadTeamCaller } from '@/lib/team-server'
import { isPlatformAdmin } from '@/lib/club-access'
import { VENUES } from '@/lib/venues'
import ClubRequests, { type ClubRequest } from '@/components/platform/ClubRequests'
import ClubFees, { type ClubFee } from '@/components/platform/ClubFees'
import { connectState } from '@/lib/connect-rules'
import { getVenue } from '@/lib/venues'

export const metadata = { title: 'Clubs and fees' }
export const dynamic = 'force-dynamic'

// For the person who runs PadelClub itself: new clubs waiting to be approved.
export default async function PlatformPage() {
  const caller = await loadTeamCaller()
  if (!caller) redirect('/club/login')
  if (!isPlatformAdmin(caller)) redirect('/')

  const { data, error } = await (createAdminClient() as any).from('club_requests').select('*').order('created_at', { ascending: false }).limit(100)
  const requests: ClubRequest[] = (data ?? []).map((r: any) => ({
    id: r.id, clubName: r.club_name, country: r.country, city: r.city, address: r.address, courts: r.courts, phone: r.phone,
    contactName: r.contact_name, email: r.email, status: r.status, venueSlug: r.venue_slug, createdAt: r.created_at,
    // The club the form named, if it is already in the list.
    suggestedSlug: VENUES.find(v => v.name.toLowerCase() === String(r.club_name).trim().toLowerCase())?.slug ?? '',
  }))
  const { data: acctRows } = await (createAdminClient() as any).from('club_stripe_accounts').select('*').order('created_at')
  const fees: ClubFee[] = (acctRows ?? []).map((a: any) => ({
    venueSlug: a.venue_slug, name: getVenue(a.venue_slug).name, state: connectState(a),
    percent: Number(a.fee_percent), fixed: Number(a.fee_fixed),
  }))
  const venues = VENUES.map(v => ({ slug: v.slug, name: v.name })).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="min-h-screen px-4 py-8" style={{ background: 'var(--bg-base)' }}>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <span className="text-sm font-extrabold tracking-[0.14em]" style={{ color: 'var(--text-primary)' }}>PADEL<span style={{ color: 'var(--brand-primary-text)' }}>CLUB</span> <span className="text-xs font-medium tracking-normal" style={{ color: 'var(--text-subtle)' }}>· Platform</span></span>
          <Link href="/admin/today" className="text-sm font-semibold" style={{ color: 'var(--brand-primary-text)' }}>Back to my club</Link>
        </div>
        {error ? <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Club requests aren&apos;t switched on yet: the database change 033 has not been run.</p> : <ClubRequests requests={requests} venues={venues} />}
        <ClubFees clubs={fees} />
      </div>
    </div>
  )
}
