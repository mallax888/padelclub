import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getVenue } from '@/lib/venues'
import { loadVenueSettings, isOpenForBooking, weekFor, closedLine } from '@/lib/venue-settings'
import { dayHours } from '@/lib/venue-hours'
import { timezoneForVenueSlug } from '@/lib/timezone'
import { bookPathFor, isLiveClub, loginPathFor, signupPathFor } from '@/lib/club-link'
import RememberClub from '@/components/club/RememberClub'

export const dynamic = 'force-dynamic'

const t12 = (hhmm: string) => {
  const h = parseInt(hhmm.slice(0, 2), 10), m = hhmm.slice(3, 5)
  return `${h % 12 || 12}${m === '00' ? '' : ':' + m} ${h < 12 ? 'am' : 'pm'}`
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const v = isLiveClub(params.slug) ? getVenue(params.slug) : null
  return { title: v ? `${v.name} | Book a court` : 'Book a court | PadelMate' }
}

// A club's own booking page, the one behind its link and QR code. Open to anyone, no account needed to look.
export default async function ClubLinkPage({ params }: { params: { slug: string } }) {
  if (!isLiveClub(params.slug)) notFound()
  const venue = getVenue(params.slug)!
  const admin = createAdminClient() as any
  const [{ data: courtRows }, settings, { data: { session } }] = await Promise.all([
    admin.from('courts').select('id, is_active').eq('venue_slug', venue.slug),
    loadVenueSettings(admin),
    createServerClient().auth.getSession(),
  ])
  const courts = ((courtRows ?? []) as any[]).filter(c => c.is_active !== false).length
  const open = isOpenForBooking(settings, venue.slug) && courts > 0
  // Has courts but the owner has switched booking off: say so, rather than "coming soon" (which is for a club with no courts yet).
  const switchedOff = courts > 0 && !isOpenForBooking(settings, venue.slug)
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: timezoneForVenueSlug(venue.slug) }).format(new Date())
  const hrs = dayHours(weekFor(settings, venue.slug), today)
  const go = session ? bookPathFor(venue.slug) : signupPathFor(venue.slug)
  const place = venue.address.split(',').slice(0, 2).join(',').trim()

  return (
    <main className="min-h-screen px-4 py-8 flex justify-center" style={{ background: 'radial-gradient(circle at 50% 0%, var(--brand-primary-muted), var(--bg-base) 60%)', color: 'var(--text-primary)' }}>
      <RememberClub slug={venue.slug} />
      <div className="w-full" style={{ maxWidth: 460 }} data-testid="club-link-page">
        <div className="text-[13px] font-extrabold mb-3" style={{ color: 'var(--text-subtle)', letterSpacing: '0.02em' }}>PADEL<span style={{ color: 'var(--brand-primary-text)' }}>MATE</span></div>
        <div className="rounded-[26px] p-6" style={{ background: 'linear-gradient(160deg, var(--brand-primary), #1d4a8f)', color: '#fff' }}>
          <div className="text-[12px] font-extrabold uppercase" style={{ letterSpacing: '0.14em', opacity: 0.75 }} data-testid="club-link-name">{venue.name}</div>
          <h1 className="text-[30px] leading-[1.1] font-extrabold mt-2" style={{ border: 0, padding: 0 }}>Book a court<br />in 30 seconds.</h1>
          <p className="text-[14px] mt-2" style={{ opacity: 0.88 }}>
            {courts > 0 ? `${courts} ${courts === 1 ? 'court' : 'courts'} · ` : ''}{place}
          </p>
        </div>

        {open ? (
          <>
            <Link href={go} data-testid="club-link-go" className="block text-center rounded-full mt-4 py-4 text-[16px] font-black" style={{ background: '#d4f53c', color: '#17240a' }}>
              Pick a day and time →
            </Link>
            <div className="rounded-2xl mt-4 px-4 py-3 text-[14px]" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }} data-testid="club-link-hours">
              <span style={{ color: 'var(--text-muted)' }}>Today </span>
              <b>{hrs ? `${t12(hrs.open)} – ${t12(hrs.close)}` : 'Closed'}</b>
            </div>
            {session ? null : (
              <>
                <p className="text-[13px] text-center mt-4" style={{ color: 'var(--text-muted)' }}>
                  New here? You&apos;ll make a free account at the next step and join {venue.name}.
                </p>
                <p className="text-[13px] text-center mt-2" style={{ color: 'var(--text-muted)' }}>
                  Already have an account? <Link href={loginPathFor(venue.slug)} className="font-bold" style={{ color: 'var(--brand-primary-text)' }} data-testid="club-link-login">Log in</Link>
                </p>
              </>
            )}
          </>
        ) : (
          <div className="rounded-2xl mt-4 px-4 py-5 text-center" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }} data-testid="club-link-closed">
            <div className="text-[16px] font-extrabold">{switchedOff ? 'Not taking bookings right now' : 'Courts coming soon'}</div>
            <p className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>{switchedOff ? `${venue.name} has paused online booking. Please check back soon.` : `${venue.name} isn't taking bookings through PadelMate yet.`}</p>
          </div>
        )}
      </div>
    </main>
  )
}
