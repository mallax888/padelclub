import { redirect } from 'next/navigation'
import { loadTeamCaller } from '@/lib/team-server'
import { covers } from '@/lib/team'
import { createAdminClient } from '@/lib/supabase-admin'
import { VENUES, getVenue } from '@/lib/venues'
import { contactsAvailable, loadContacts } from '@/lib/contacts-server'
import { contactSummary } from '@/lib/contact-rules'
import ImportPlayers from '@/components/players/ImportPlayers'

export const metadata = { title: 'Import players' }
export const dynamic = 'force-dynamic'

// Owner only: bring a club's existing player list in from a spreadsheet, then invite them.
export default async function ImportPage({ searchParams }: { searchParams?: { venue?: string; step?: string } }) {
  const caller = await loadTeamCaller()
  if (!caller || caller.role !== 'admin') redirect('/players')
  const admin = createAdminClient() as any
  const { data: cts } = await admin.from('courts').select('venue_slug').eq('is_active', true)
  const withCourts = new Set(((cts ?? []) as any[]).map(c => c.venue_slug as string))
  const choices = VENUES.filter(v => v.isLive && withCourts.has(v.slug) && covers(caller.reach, { kind: 'club', venueSlug: v.slug }))
  const slug = choices.find(v => v.slug === searchParams?.venue)?.slug ?? choices[0]?.slug
  if (!slug) redirect('/players')
  const available = await contactsAvailable(admin)
  const summary = available ? contactSummary(await loadContacts(admin, slug), Date.now()) : null
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Import players</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Bring your existing players across, then invite them to book on PadelMate</p>
      </div>
      {available ? (
        <ImportPlayers key={slug} venueSlug={slug} club={getVenue(slug)!.name} pending={summary?.toInvite ?? 0} startAtInvite={searchParams?.step === 'invite'} emailReady={!!process.env.RESEND_API_KEY} />
      ) : (
        <div className="rounded-[22px] p-6 max-w-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }} data-testid="import-unavailable">
          <div className="text-[16px] font-extrabold" style={{ color: 'var(--text-primary)' }}>Player import isn&apos;t switched on yet</div>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>A one-time database change needs to be run first. Nothing is lost.</p>
        </div>
      )}
    </div>
  )
}
