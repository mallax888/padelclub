import { resend } from '@/lib/resend'
import { renderEmailShell } from '@/lib/email-template'
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { formatDate } from '@/lib/utils'
import { getVenue } from '@/lib/venues'

// Previously trusted an arbitrary `players` array of {email, name} straight
// from the client with no auth check -- anyone could make the app blast a
// "your match is full" email to any list of addresses they supplied. Now
// requires the organizer's session and re-derives the accepted player list
// from the database.
export async function POST(request: Request) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { matchId } = await request.json()
  if (!matchId) {
    return NextResponse.json({ error: 'Missing matchId' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: match } = await admin
    .from('open_matches')
    .select('organizer_id, date, start_time, end_time, venue_slug, status, courts(name)')
    .eq('id', matchId)
    .maybeSingle()
  if (!match?.organizer_id) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 })
  }
  if (match.organizer_id !== session.user.id) {
    return NextResponse.json({ error: 'Only the match organizer can trigger this' }, { status: 403 })
  }
  if (match.status !== 'full') {
    return NextResponse.json({ error: 'This match is not full' }, { status: 400 })
  }

  const { data: accepted } = await admin
    .from('open_match_players')
    .select('profiles(email, full_name, nickname)')
    .eq('match_id', matchId)
    .eq('status', 'accepted')
  const recipients = (accepted ?? [])
    .map(a => a.profiles as any)
    .filter(p => p?.email)
    .map(p => ({ email: p.email as string, name: p.nickname ?? p.full_name ?? 'Player' }))

  if (recipients.length === 0) {
    return NextResponse.json({ success: true })
  }

  const venue = getVenue(match.venue_slug)
  const court = (match.courts as any)?.name ?? 'Court'
  const date = formatDate(match.date)
  const time = `${match.start_time.slice(0, 5)}–${match.end_time.slice(0, 5)}`
  const matchUrl = `${new URL(request.url).origin}/find-a-game`

  try {
    await Promise.all(
      recipients.map(player =>
        resend.emails.send({
          from: 'PadelClub <onboarding@resend.dev>',
          to: player.email,
          subject: `Match is full — ${court}, ${date}`,
          html: renderEmailShell({
            heading: '🎾 Your match is full!',
            intro: `Hi ${player.name}, all 4 spots are filled. See you on the court!`,
            rows: [
              { label: 'Court', value: court },
              { label: 'Date', value: date },
              { label: 'Time', value: time },
            ],
            ctaText: 'View match',
            ctaUrl: matchUrl,
            footer: `PadelClub · ${venue.name}, ${venue.region}`,
          }),
        })
      )
    )
  } catch (error) {
    console.error('Failed to send match-full emails:', error)
  }

  return NextResponse.json({ success: true })
}
