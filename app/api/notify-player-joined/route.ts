import { resend } from '@/lib/resend'
import { renderEmailShell } from '@/lib/email-template'
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { formatDate } from '@/lib/utils'
import { getVenue } from '@/lib/venues'

// Same fix as the other find-a-game notify routes: was unauthenticated and
// trusted every field from the client. Now requires the organizer's session
// and looks the player/court/date/time up server-side.
export async function POST(request: Request) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { matchId, playerId } = await request.json()
  if (!matchId || !playerId) {
    return NextResponse.json({ error: 'Missing matchId or playerId' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: match } = await admin
    .from('open_matches')
    .select('organizer_id, date, start_time, end_time, venue_slug, courts(name)')
    .eq('id', matchId)
    .maybeSingle()
  if (!match?.organizer_id) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 })
  }
  if (match.organizer_id !== session.user.id) {
    return NextResponse.json({ error: 'Only the match organizer can trigger this' }, { status: 403 })
  }

  const { data: joinedPlayer } = await admin
    .from('open_match_players')
    .select('status, profiles(full_name, nickname)')
    .eq('match_id', matchId)
    .eq('player_id', playerId)
    .maybeSingle()
  if (!joinedPlayer || joinedPlayer.status !== 'accepted') {
    return NextResponse.json({ error: 'This player has not been accepted into the match' }, { status: 404 })
  }

  const { data: organizer } = await admin.from('profiles').select('email, full_name, nickname').eq('id', match.organizer_id).single()
  if (!organizer?.email) {
    return NextResponse.json({ success: true })
  }

  const venue = getVenue(match.venue_slug)
  const court = (match.courts as any)?.name ?? 'Court'
  const date = formatDate(match.date)
  const time = `${match.start_time.slice(0, 5)}–${match.end_time.slice(0, 5)}`
  const playerProfile = joinedPlayer.profiles as any
  const playerName = playerProfile?.nickname ?? playerProfile?.full_name ?? 'A player'
  const organizerName = organizer.nickname ?? organizer.full_name ?? 'Organizer'
  const matchUrl = `${new URL(request.url).origin}/find-a-game`

  try {
    await resend.emails.send({
      from: 'PadelClub <onboarding@resend.dev>',
      to: organizer.email,
      subject: `${playerName} joined your match — ${court}, ${date}`,
      html: renderEmailShell({
        heading: '🎾 New player joined!',
        intro: `Hi ${organizerName}, <strong>${playerName}</strong> has joined your match.`,
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
  } catch (error) {
    console.error('Failed to send player-joined email:', error)
  }

  return NextResponse.json({ success: true })
}
