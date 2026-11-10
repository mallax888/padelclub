'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { formatDate, getInitials, localDateStr } from '@/lib/utils'
import { skillLabelForRating } from '@/lib/skill-levels'
import { getVenue } from '@/lib/venues'
import { timezoneForVenueSlug, venueInstant } from '@/lib/timezone'

type MatchPlayer = {
  id: string
  player_id: string
  status: string
  profiles: { id: string; full_name: string | null; nickname: string | null; skill_rating: number; skill_level?: string | null; email?: string | null } | null
}

type OpenMatch = {
  id: string
  date: string
  start_time: string
  end_time: string
  venue_slug: string
  match_type: string
  skill_min: number
  skill_max: number
  spots_total: number
  notes: string | null
  organizer_id: string
  courts: { name: string; type: string } | null
  open_match_players: MatchPlayer[]
}

// Always derived from the numeric skill_rating (kept accurate by actual
// match results, see lib/elo.ts) rather than the self-declared skill_level
// string -- that string is what caused "over-ranked" pairing complaints,
// since it's set once at onboarding and nothing ever corrected it.
function skillLabelForRange(min: number, max: number) {
  const lo = skillLabelForRating(min)
  const hi = skillLabelForRating(max)
  // A game open to every tier reads better as "All levels" than as a range
  // from the bottom of the scale to the top.
  if (lo === 'Beginner' && hi === 'Elite') return 'All levels'
  return lo === hi ? lo : `${lo} – ${hi}`
}

// Where this player sits against a game's level range. Null when they have no
// rating yet (a profile that skipped the level question), in which case no
// verdict is shown at all rather than a wrong one.
type Fit = 'fits' | 'above' | 'below' | null
function levelFit(rating: number | null, min: number, max: number): Fit {
  if (rating === null || !Number.isFinite(rating)) return null
  if (rating < min) return 'above'
  if (rating > max) return 'below'
  return 'fits'
}
const FIT_LABEL = { fits: 'Fits your level', above: 'Above your level', below: 'Below your level' } as const

// Module scope, not inside the list: a component defined in a render is a new
// component every render, which remounts it and drops focus on every tap.
function FilterChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className="inline-flex items-center gap-2 text-xs font-bold px-4 rounded-full whitespace-nowrap"
      style={{
        minHeight: 40,
        background: on ? 'var(--brand-primary-muted)' : 'var(--bg-raised)',
        border: `1px solid ${on ? 'var(--brand-primary)' : 'var(--border)'}`,
        color: on ? 'var(--brand-primary-text)' : 'var(--text-muted)',
      }}>
      {/* The indicator is always there and only changes colour, so turning a
          filter on never changes the chip's width or shoves its neighbours. */}
      <span style={{
        width: 8, height: 8, borderRadius: 999, flexShrink: 0,
        background: on ? 'var(--brand-primary)' : 'transparent',
        border: `1.5px solid ${on ? 'var(--brand-primary)' : 'var(--text-subtle)'}`,
      }} />
      {children}
    </button>
  )
}

export default function FindGameList({
  matches,
  currentUserId,
  viewerRating,
  homeVenueSlug,
}: {
  matches: OpenMatch[]
  currentUserId: string
  // The viewer's own skill rating and home club, so the list can say which
  // games suit them. Both can be null (never rated, no home club chosen), and
  // then the matching controls simply aren't offered.
  viewerRating: number | null
  homeVenueSlug: string | null
}) {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [fitsOnly, setFitsOnly] = useState(false)
  const [myClubOnly, setMyClubOnly] = useState(false)
  const [todayOnly, setTodayOnly] = useState(false)

  // The viewer's clock and calendar, read after mount. This component is
  // rendered on the server first, and the server's idea of "today" is UTC's --
  // up to a day off for anyone in NZ, AU or SA. Working out Today / Tomorrow
  // while rendering would give the server and the browser different answers and
  // a hydration warning; until this is set, days are labelled by their date and
  // nothing is hidden for having started, and then it fills in. Ticks each
  // minute so a game drops off the list when it starts.
  const [clock, setClock] = useState<{ now: number; today: string; tomorrow: string } | null>(null)
  useEffect(() => {
    const tick = () => {
      const d = new Date()
      setClock({ now: d.getTime(), today: localDateStr(d), tomorrow: localDateStr(new Date(d.getTime() + 24 * 60 * 60 * 1000)) })
    }
    tick()
    const id = setInterval(tick, 60 * 1000)
    return () => clearInterval(id)
  }, [])

  const handleRequest = async (match: OpenMatch) => {
    setLoading(match.id + '-request')

    const { error } = await supabase
      .from('open_match_players')
      .insert({ match_id: match.id, player_id: currentUserId, status: 'pending' })

    if (error) {
      toast.error(error.code === '23505' ? "You've already requested to join!" : 'Could not send request — please try again.')
      setLoading(null)
      return
    }

    toast.success('Request sent! Waiting for the organizer to accept.')

    try {
      await fetch('/api/notify-join-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: match.id }),
      })
    } catch {}

    router.refresh()
    setLoading(null)
  }

  const handleResponse = async (match: OpenMatch, playerId: string, accept: boolean) => {
    setLoading(match.id + '-' + playerId)

    const request = match.open_match_players.find(p => p.player_id === playerId)
    if (!request) {
      toast.error('Request not found')
      setLoading(null)
      return
    }

    if (accept) {
      // accept_match_player re-checks capacity and locks the match row
      // server-side, so two requests accepted at nearly the same moment
      // can't both slip through and overfill the match.
      const { data: accepted, error } = await supabase.rpc('accept_match_player', { p_request_id: request.id })
      if (error) {
        toast.error('Could not accept — please try again.')
        setLoading(null)
        return
      }
      if (!accepted) {
        toast.error('This match just filled up.')
        setLoading(null)
        router.refresh()
        return
      }
    } else {
      const { error } = await supabase
        .from('open_match_players')
        .update({ status: 'declined' })
        .eq('match_id', match.id)
        .eq('player_id', playerId)
      if (error) {
        toast.error('Could not update request')
        setLoading(null)
        return
      }
    }

    toast.success(accept ? 'Player accepted!' : 'Request declined.')

    try {
      await fetch('/api/notify-join-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: match.id, playerId }),
      })
    } catch {}

    if (accept) {
      try {
        await fetch('/api/notify-player-joined', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ matchId: match.id, playerId }),
        })
      } catch {}

      const acceptedPlayers = match.open_match_players.filter(p =>
        p.status === 'accepted' || p.player_id === playerId
      )
      if (acceptedPlayers.length >= match.spots_total) {
        // accept_match_player already flipped open_matches to 'full' -- this
        // branch only decides whether to also fire the "match is full" emails.
        try {
          await fetch('/api/notify-match-full', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ matchId: match.id }),
          })
        } catch {}
      }
    }

    router.refresh()
    setLoading(null)
  }

  const handleLeave = async (matchId: string) => {
    setLoading(matchId + '-leave')
    const { error } = await supabase
      .from('open_match_players')
      .delete()
      .eq('match_id', matchId)
      .eq('player_id', currentUserId)

    if (error) {
      toast.error('Could not leave match')
    } else {
      toast.success('Left the match.')
      router.refresh()
    }
    setLoading(null)
  }

  if (matches.length === 0) {
    return (
      <div className="rounded-xl text-center py-16"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-subtle)' }}>
        <div className="text-3xl mb-3">🎾</div>
        <div className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>No open play right now</div>
        {/* This told people exactly what to do and then left them to find it
            themselves. The one moment someone wants to start a game is a poor
            moment to hand them a dead end. */}
        <div className="text-xs mb-4">Book a court, turn on Open play, and be the first.</div>
        <Link href="/book"
          className="inline-flex text-xs font-bold px-4 py-2 rounded-lg"
          style={{ background: 'var(--brand-primary)', color: 'var(--brand-primary-on)' }}>
          Book a court
        </Link>
      </div>
    )
  }

  const fitOf = (m: OpenMatch) => levelFit(viewerRating, Number(m.skill_min), Number(m.skill_max))

  const visible = matches.filter(match => {
    if (clock) {
      // A game that has started is not one anyone can still join. The court's
      // own clock decides, not the visitor's. The exception is a game you are
      // running or playing in, which stays until it ends.
      const tz = timezoneForVenueSlug(match.venue_slug)
      const starts = venueInstant(match.date, match.start_time, tz).getTime()
      const ends = venueInstant(match.date, match.end_time, tz).getTime()
      const mine = (match.open_match_players ?? []).find(p => p.player_id === currentUserId)
      const involved = match.organizer_id === currentUserId || mine?.status === 'accepted'
      if (starts <= clock.now && !(involved && ends > clock.now)) return false
      if (todayOnly && match.date !== clock.today) return false
    }
    if (myClubOnly && match.venue_slug !== homeVenueSlug) return false
    if (fitsOnly && fitOf(match) !== 'fits') return false
    return true
  })

  // Soonest day first; within a day, the games that suit you ahead of the ones
  // that don't, then by start time.
  const ordered = [...visible].sort((a, b) =>
    a.date.localeCompare(b.date)
    || (fitOf(a) === 'fits' ? 0 : 1) - (fitOf(b) === 'fits' ? 0 : 1)
    || a.start_time.localeCompare(b.start_time))

  const days: { date: string; matches: OpenMatch[] }[] = []
  for (const m of ordered) {
    const last = days[days.length - 1]
    if (last && last.date === m.date) last.matches.push(m)
    else days.push({ date: m.date, matches: [m] })
  }
  const dayLabel = (date: string) =>
    clock && date === clock.today ? 'Today' : clock && date === clock.tomorrow ? 'Tomorrow' : formatDate(date)

  const clearFilters = () => { setFitsOnly(false); setMyClubOnly(false); setTodayOnly(false) }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-5">
        {viewerRating !== null && <FilterChip on={fitsOnly} onClick={() => setFitsOnly(v => !v)}>Fits my level</FilterChip>}
        {homeVenueSlug && <FilterChip on={myClubOnly} onClick={() => setMyClubOnly(v => !v)}>My club</FilterChip>}
        <FilterChip on={todayOnly} onClick={() => setTodayOnly(v => !v)}>Today</FilterChip>
      </div>

      {days.length === 0 && (
        <div className="rounded-2xl text-center py-12 px-4"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No games match those filters</div>
          <div className="text-xs mb-4" style={{ color: 'var(--text-subtle)' }}>Games that have already started aren&apos;t shown.</div>
          <button type="button" onClick={clearFilters}
            className="text-xs font-bold px-4 rounded-xl"
            style={{ minHeight: 40, background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
            Clear filters
          </button>
        </div>
      )}

      {days.map(day => (
        <section key={day.date} className="mb-6">
          <div className="text-[11px] font-extrabold uppercase mb-2.5 px-0.5"
            style={{ letterSpacing: '0.14em', color: 'var(--text-subtle)' }}>
            {dayLabel(day.date)}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {day.matches.map(match => {
              const allPlayers = match.open_match_players ?? []
              const acceptedPlayers = allPlayers.filter(p => p.status === 'accepted')
              const pendingPlayers = allPlayers.filter(p => p.status === 'pending' && p.player_id !== match.organizer_id)
              const spotsLeft = match.spots_total - acceptedPlayers.length
              const isOrganizer = match.organizer_id === currentUserId
              const myEntry = allPlayers.find(p => p.player_id === currentUserId)
              const isFull = spotsLeft <= 0
              const fit = fitOf(match)
              const venue = getVenue(match.venue_slug)

              return (
                <div key={match.id} className="rounded-2xl p-4"
                  style={{
                    background: 'var(--bg-surface)',
                    border: `1px solid ${fit === 'fits' ? 'var(--brand-primary)' : 'var(--border)'}`,
                    boxShadow: fit === 'fits' ? '0 0 0 1px var(--brand-primary-muted), var(--shadow-float)' : 'var(--shadow-float)',
                  }}>

                  {/* When leads: it is the first thing anyone is deciding on. */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="leading-none" style={{ fontFamily: 'var(--font-display), Manrope, sans-serif', color: 'var(--text-primary)' }}>
                      <span className="text-[30px] font-extrabold" style={{ letterSpacing: '-0.02em' }}>{match.start_time.slice(0, 5)}</span>
                      <span className="text-sm font-semibold ml-1" style={{ color: 'var(--text-muted)' }}>–{match.end_time.slice(0, 5)}</span>
                    </div>
                    {fit && (
                      <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-full whitespace-nowrap shrink-0"
                        style={fit === 'fits'
                          ? { background: 'var(--brand-primary)', color: 'var(--brand-primary-on)' }
                          : { background: 'var(--bg-raised)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                        {FIT_LABEL[fit]}
                      </span>
                    )}
                  </div>

                  <div className="text-[13px] font-semibold mt-2.5" style={{ color: 'var(--text-primary)' }}>
                    {match.courts?.name}
                    <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}> · {venue.name}</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    <span className="text-[11px] font-semibold px-2 py-1 rounded-lg"
                      style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                      {skillLabelForRange(match.skill_min, match.skill_max)}
                    </span>
                    <span className="text-[11px] font-semibold px-2 py-1 rounded-lg capitalize"
                      style={{
                        background: match.match_type === 'competitive' ? 'var(--brand-accent-muted)' : 'var(--bg-raised)',
                        border: `1px solid ${match.match_type === 'competitive' ? 'transparent' : 'var(--border)'}`,
                        color: match.match_type === 'competitive' ? 'var(--brand-accent)' : 'var(--text-muted)',
                      }}>
                      {match.match_type}
                    </span>
                  </div>

                  {/* Who is in, and how many seats are left. */}
                  <div className="flex items-center justify-between mt-3.5">
                    <div className="flex -space-x-2">
                      {acceptedPlayers.map(p => (
                        <div key={p.player_id}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold"
                          style={{ background: 'var(--brand-primary)', color: 'var(--brand-primary-on)', border: '2px solid var(--bg-surface)' }}
                          title={p.profiles?.nickname ?? p.profiles?.full_name ?? 'Player'}>
                          {getInitials(p.profiles?.full_name ?? '?')}
                        </div>
                      ))}
                      {Array.from({ length: Math.max(spotsLeft, 0) }).map((_, i) => (
                        <div key={`empty-${i}`}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs"
                          style={{ background: 'var(--bg-surface)', border: '1.5px dashed var(--text-subtle)', color: 'var(--text-subtle)', fontWeight: 700 }}>
                          +
                        </div>
                      ))}
                    </div>
                    {/* Accent text, not the yellow: yellow is fine on dark and close
                        to unreadable on a light ground. */}
                    <span className="text-xs font-bold" style={{ color: isFull ? 'var(--text-subtle)' : 'var(--brand-primary-text)' }}>
                      {isFull ? 'Full' : `${spotsLeft} ${spotsLeft === 1 ? 'spot' : 'spots'} left`}
                    </span>
                  </div>

                  {/* Who exactly, and at what level -- worth knowing before
                      asking to join, and kept from the old card. */}
                  {acceptedPlayers.length > 0 && (
                    <div className="space-y-1 mt-3">
                      {acceptedPlayers.map(p => (
                        <div key={p.player_id} className="flex items-center justify-between text-xs">
                          <span style={{ color: 'var(--text-primary)' }}>
                            {p.profiles?.nickname ?? p.profiles?.full_name ?? 'Player'}
                            {p.player_id === match.organizer_id && (
                              <span style={{ color: 'var(--text-subtle)' }}> · organizer</span>
                            )}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                            style={{ background: 'var(--bg-raised)', color: 'var(--brand-primary-text)' }}>
                            {skillLabelForRating(p.profiles?.skill_rating)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Pending requests — only visible to organizer */}
                  {isOrganizer && pendingPlayers.length > 0 && (
                    <div className="rounded-lg p-3 mt-3"
                      style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
                      <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                        {pendingPlayers.length} pending request{pendingPlayers.length > 1 ? 's' : ''}
                      </div>
                      {pendingPlayers.map(p => (
                        <div key={p.player_id} className="flex items-center justify-between gap-2 py-1.5"
                          style={{ borderTop: '1px solid var(--border)' }}>
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                              {getInitials(p.profiles?.full_name ?? '?')}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                {p.profiles?.nickname ?? p.profiles?.full_name ?? 'Player'}
                              </div>
                              <div className="text-[10px]" style={{ color: 'var(--text-subtle)' }}>
                                {skillLabelForRating(p.profiles?.skill_rating)}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1.5 shrink-0">
                            <button
                              className="text-xs px-3 rounded-lg font-semibold transition-all"
                              style={{ minHeight: 36, background: 'var(--brand-primary)', color: 'var(--brand-primary-on)' }}
                              disabled={loading === match.id + '-' + p.player_id}
                              onClick={() => handleResponse(match, p.player_id, true)}
                            >
                              Accept
                            </button>
                            <button
                              className="text-xs px-3 rounded-lg font-semibold transition-all"
                              style={{ minHeight: 36, background: 'var(--brand-accent-muted)', color: 'var(--brand-accent)' }}
                              disabled={loading === match.id + '-' + p.player_id}
                              onClick={() => handleResponse(match, p.player_id, false)}
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {match.notes && (
                    <div className="text-xs mt-3 italic" style={{ color: 'var(--text-subtle)' }}>
                      &quot;{match.notes}&quot;
                    </div>
                  )}

                  {/* Action button: one clear action per card, full width. */}
                  <div className="mt-3.5">
                    {isOrganizer ? (
                      <div className="text-xs text-center py-3 rounded-xl"
                        style={{ background: 'var(--bg-raised)', color: 'var(--text-primary)', fontWeight: 600 }}>
                        You&apos;re organizing this match
                      </div>
                    ) : myEntry?.status === 'accepted' ? (
                      <button
                        className="btn btn-danger w-full justify-center"
                        style={{ minHeight: 44 }}
                        disabled={loading === match.id + '-leave'}
                        onClick={() => handleLeave(match.id)}
                      >
                        {loading === match.id + '-leave' ? '…' : 'Leave match'}
                      </button>
                    ) : myEntry?.status === 'pending' ? (
                      <div className="text-xs text-center py-3 rounded-xl"
                        style={{ background: 'var(--brand-primary-muted)', color: 'var(--brand-primary-text)' }}>
                        Request pending — waiting for organizer
                      </div>
                    ) : (
                      <button
                        className="w-full rounded-xl text-sm font-extrabold disabled:opacity-60"
                        style={isFull || fit === 'above' || fit === 'below'
                          ? { minHeight: 44, background: 'var(--bg-raised)', color: 'var(--text-primary)', border: '1px solid var(--border)' }
                          : { minHeight: 44, background: 'var(--brand-primary)', color: 'var(--brand-primary-on)', boxShadow: 'var(--glow-primary)' }}
                        disabled={isFull || loading === match.id + '-request'}
                        onClick={() => handleRequest(match)}
                      >
                        {loading === match.id + '-request' ? '…' : isFull ? 'Match full' : 'Request to join'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
