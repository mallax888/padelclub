import { resend } from '@/lib/resend'
import { renderEmailShell, EMAIL_BRAND } from '@/lib/email-template'
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { formatDate } from '@/lib/utils'
import { getVenue } from '@/lib/venues'

// Previously this trusted a client-supplied `accepted` boolean and raw
// playerEmail/name/court/date/time with no auth check -- anyone could make
// the app send an "accepted"/"declined" email, for any match, to any
// address. Now the caller must be the match's organizer, and whether it was
// an accept or a decline is read back from the actual open_match_players
// row rather than trusted from the request body.
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

  const { data: joinRequest } = await admin
    .from('open_match_players')
    .select('status')
    .eq('match_id', matchId)
    .eq('player_id', playerId)
    .maybeSingle()
  if (!joinRequest || (joinRequest.status !== 'accepted' && joinRequest.status !== 'declined')) {
    return NextResponse.json({ error: 'No resolved request found for this player' }, { status: 404 })
  }
  const accepted = joinRequest.status === 'accepted'

  const { data: player } = await admin.from('profiles').select('email, full_name, nickname').eq('id', playerId).single()
  if (!player?.email) {
    return NextResponse.json({ success: true })
  }

  const venue = getVenue(match.venue_slug)
  const court = (match.courts as any)?.name ?? 'Court'
  const date = formatDate(match.date)
  const time = `${match.start_time.slice(0, 5)}–${match.end_time.slice(0, 5)}`
  const playerName = player.nickname ?? player.full_name ?? 'Player'
  const matchUrl = `${new URL(request.url).origin}/find-a-game`
  const accentColor = accepted ? EMAIL_BRAND.primary : EMAIL_BRAND.crimson

  try {
    await resend.emails.send({
      from: 'PadelClub <onboarding@resend.dev>',
      to: player.email,
      subject: accepted ? `You're in! ${court}, ${date}` : `Match request declined — ${court}, ${date}`,
      html: renderEmailShell({
        accentColor,
        accentOn: accepted ? EMAIL_BRAND.primaryOn : '#fff',
        heading: accepted ? "🎾 You're in!" : '❌ Request declined',
        intro: `Hi ${playerName}, your request to join the match at <strong>${court}</strong> has been <strong>${accepted ? 'accepted' : 'declined'}</strong>.`,
        rows: [
          { label: 'Court', value: court },
          { label: 'Date', value: date },
          { label: 'Time', value: time },
        ],
        ctaText: accepted ? 'View match' : undefined,
        ctaUrl: accepted ? matchUrl : undefined,
        footer: `PadelClub · ${venue.name}, ${venue.region}`,
      }),
    })
  } catch (error) {
    console.error('Failed to send join-response email:', error)
  }

  return NextResponse.json({ success: true })
}
