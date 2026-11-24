import { createAdminClient } from '@/lib/supabase-admin'
import { getVenue } from '@/lib/venues'
import { maskEmail, verifyUnsub } from '@/lib/unsubscribe'
import UnsubscribeButton from '@/components/club/UnsubscribeButton'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Unsubscribe | PadelMate', robots: { index: false } }

// The page behind the Unsubscribe link in an invite or reminder. Asks first: opening the link alone changes nothing.
export default async function UnsubscribePage({ searchParams }: { searchParams: { c?: string; s?: string } }) {
  const valid = verifyUnsub(searchParams?.c, searchParams?.s)
  let contact: { email: string; venue_slug: string; unsubscribed_at: string | null } | null = null
  if (valid) {
    const { data } = await (createAdminClient() as any).from('club_contacts').select('email, venue_slug, unsubscribed_at').eq('id', searchParams.c).maybeSingle()
    contact = data ?? null
  }
  const club = contact ? getVenue(contact.venue_slug)?.name ?? 'this club' : ''
  return (
    <main className="min-h-screen px-4 py-10 flex justify-center" style={{ background: 'radial-gradient(circle at 50% 0%, var(--brand-primary-muted), var(--bg-base) 60%)', color: 'var(--text-primary)' }}>
      <div className="w-full" style={{ maxWidth: 440 }}>
        <div className="text-[13px] font-extrabold mb-3" style={{ color: 'var(--text-subtle)' }}>PADEL<span style={{ color: 'var(--brand-primary-text)' }}>MATE</span></div>
        <div className="rounded-[22px] p-6" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }} data-testid="unsub-page">
          {!contact ? (
            <>
              <h1 className="text-xl font-extrabold" style={{ border: 0, padding: 0 }}>This link is not valid</h1>
              <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>It may be incomplete. Use the Unsubscribe link at the bottom of the email.</p>
            </>
          ) : contact.unsubscribed_at ? (
            <>
              <h1 className="text-xl font-extrabold" style={{ border: 0, padding: 0 }}>You are already unsubscribed</h1>
              <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }} data-testid="unsub-already">{club} will not email {maskEmail(contact.email)} again.</p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-extrabold" style={{ border: 0, padding: 0 }}>Unsubscribe from {club}?</h1>
              <p className="text-sm mt-2 mb-5" style={{ color: 'var(--text-muted)' }}>{club} will stop emailing <b style={{ color: 'var(--text-primary)' }}>{maskEmail(contact.email)}</b> about joining PadelMate.</p>
              <UnsubscribeButton contactId={searchParams.c as string} sig={searchParams.s as string} />
            </>
          )}
        </div>
      </div>
    </main>
  )
}
