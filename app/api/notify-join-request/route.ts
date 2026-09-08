import { resend } from '@/lib/resend'
import { renderEmailShell } from '@/lib/email-template'
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { formatDate } from '@/lib/utils'
import { getVenue } from '@/lib/venues'

// Previously this route trusted every field (organizerEmail, playerName,
// court, date, time, matchUrl) straight from the request body with no
// authentication check at all -- anyone, logged in or not, could POST here
// and make the app's own Resend account send an official-looking "PadelClub"
// email to any address, saying anything, linking anywhere. Now the caller
// must be signed in and must actually hold the pending request this email is
// about; every value in the email is looked up server-side instead of
// trusted from the client.
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

  const { data: myRequest } = await admin
    .from('open_match_players')
    .select('id')
    .eq('match_id', matchId)
    .eq('player_id', session.user.id)
    .eq('status', 'pending')
    .maybeSingle()
  if (!myRequest) {
    return NextResponse.json({ error: 'No pending request found for this match' }, { status: 403 })
  }

  const { data: match } = await admin
    .from('open_matches')
    .select('organizer_id, date, start_time, end_time, venue_slug, courts(name)')
    .eq('id', matchId)
    .maybeSingle()
  if (!match?.organizer_id) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 })
  }

  const [{ data: organizer }, { data: me }] = await Promise.all([
    admin.from('profiles').select('email, full_name, nickname').eq('id', match.organizer_id).single(),
    admin.from('profiles').select('full_name, nickname').eq('id', session.user.id).single(),
  ])
  if (!organizer?.email) {
    return NextResponse.json({ success: true }) // nothing to notify, not an error
  }

  const venue = getVenue(match.venue_slug)
  const court = (match.courts as any)?.name ?? 'Court'
  const date = formatDate(match.date)
  const time = `${match.start_time.slice(0, 5)}–${match.end_time.slice(0, 5)}`
  const playerName = me?.nickname ?? me?.full_name ?? 'A player'
  const organizerName = organizer.nickname ?? organizer.full_name ?? 'Organizer'
  const matchUrl = `${new URL(request.url).origin}/find-a-game`

  try {
    await resend.emails.send({
      from: 'PadelClub <onboarding@resend.dev>',
      to: organizer.email,
      subject: `${playerName} wants to join your match — ${court}, ${date}`,
      html: renderEmailShell({
        heading: '🎾 Join request!',
        intro: `Hi ${organizerName}, <strong>${playerName}</strong> wants to join your match.`,
        rows: [
          { label: 'Court', value: court },
          { label: 'Date', value: date },
          { label: 'Time', value: time },
        ],
        extraHtml: `<p style="color:#9BB0BC;font-size:13px;margin:16px 0 0">Log in to accept or decline this request.</p>`,
        ctaText: 'View match',
        ctaUrl: matchUrl,
        footer: `PadelClub · ${venue.name}, ${venue.region}`,
      }),
    })
  } catch (error) {
    console.error('Failed to send join-request email:', error)
  }

  await admin.from('notifications').insert({
    user_id: match.organizer_id,
    type: 'join_request',
    message: `${playerName} wants to join your match on ${court} — ${date} at ${time}`,
  })

  return NextResponse.json({ success: true })
}
