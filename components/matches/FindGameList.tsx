'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { formatDate, getInitials, localDateStr } from '@/lib/utils'
import { skillLabelForRating } from '@/lib/skill-levels'
import {
  joinWarning, levelFit, levelNumber, qualityOf, QUALITY_LABEL, rankForYou, reliabilityOf, spreadOf, suggestTeams,
  RELIABLE_MATCHES, type GameLite, type JoinWarning, type Quality,
} from '@/lib/matchmaking'
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

type Fit = ReturnType<typeof levelFit>
const FIT_LABEL = { fits: 'Fits your level', above: 'Above your level', below: 'Below your level' } as const

const QUALITY_STYLE: Record<Quality, { bg: string; fg: string }> = {
  even: { bg: 'var(--brand-green-muted)', fg: 'var(--brand-green)' },
  mixed: { bg: 'var(--brand-yellow-muted)', fg: 'var(--brand-yellow)' },
  uneven: { bg: 'var(--brand-crimson-muted)', fg: 'var(--brand-crimson)' },
}
function QualityChip({ quality, title }: { quality: Quality; title?: string }) {
  return (
    <span data-testid="quality" data-quality={quality} title={title} className="text-[11px] font-extrabold px-2.5 py-1 rounded-full whitespace-nowrap shrink-0"
      style={{ background: QUALITY_STYLE[quality].bg, color: QUALITY_STYLE[quality].fg }}>
      {QUALITY_LABEL[quality]}
    </span>
  )
}

const matchesText = (n: number | undefined | null): string | null => {
  if (n === undefined || n === null) return null
  if (n >= RELIABLE_MATCHES) return `${n} matches`
  return n === 0 ? 'New · no matches yet' : `New · ${n} ${n === 1 ? 'match' : 'matches'}`
}

// The viewer's own level: the number, the tier, how settled it is, and where it
// sits on the scale. Nothing is claimed about reliability if the counts are unknown.
function YourLevelCard({ rating, matches }: { rating: number; matches: number | null }) {
  const reliability = reliabilityOf(matches)
  const TIERS = ['Beginner', 'Improver', 'Intermediate', 'Advanced', 'Elite']
  return (
    <div className="rounded-2xl p-4 mb-4" data-testid="your-level" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
      <div className="text-[11px] font-extrabold uppercase" style={{ letterSpacing: '0.14em', color: 'var(--text-subtle)' }}>Your level</div>
      <div className="flex items-baseline gap-2.5 mt-1.5">
        <span className="text-[38px] leading-none font-extrabold" style={{ fontFamily: 'var(--font-display), Manrope, sans-serif', letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>{levelNumber(rating)}</span>
        <span className="text-sm font-bold" style={{ color: 'var(--brand-primary-text)' }}>{skillLabelForRating(rating)}</span>
        {reliability && (
          <span className="ml-auto text-[11px] font-extrabold px-2.5 py-1 rounded-full" data-testid="reliability"
            style={reliability === 'reliable' ? { background: 'var(--brand-green-muted)', color: 'var(--brand-green)' } : { background: 'var(--bg-raised)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
            {reliability === 'reliable' ? 'Reliable' : 'New'}
          </span>
        )}
      </div>
      <div className="relative mt-3.5 h-2 rounded-full" style={{ background: 'var(--bg-raised)' }}>
        <span className="absolute -top-1 rounded-full" style={{ left: `calc(${Math.min(Math.max(((rating - 0.5) / 6.5) * 100, 0), 100)}% - 8px)`, width: 16, height: 16, background: 'var(--brand-primary)', border: '3px solid var(--bg-surface)' }} />
      </div>
      <div className="flex justify-between text-[10px] mt-1.5" style={{ color: 'var(--text-subtle)' }}>{TIERS.map(t => <span key={t}>{t}</span>)}</div>
      <div className="text-xs mt-2.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        {matches === null ? 'Your level moves as you record matches.'
          : matches >= RELIABLE_MATCHES ? `From your last ${matches} recorded matches. Win an even game and it moves up.`
          : matches === 0 ? "You haven't recorded a match yet, so this is the level you chose. It moves as you play."
          : `Based on ${matches} recorded ${matches === 1 ? 'match' : 'matches'} so far. It settles after ${RELIABLE_MATCHES}.`}
        {' '}<Link href="/record-match" style={{ color: 'var(--brand-primary-text)', fontWeight: 700 }}>Record a match</Link>
      </div>
    </div>
  )
}

type DetailPlayer = { id: string; name: string; rating: number | null }

// Everyone in a game with their level and how settled it is, and the fairest way
// to split four into teams, so it is clear whether the game will be a close one.
function LevelDetails({ players, counts, youIfJoin }: { players: DetailPlayer[]; counts: Record<string, number> | null; youIfJoin: DetailPlayer | null }) {
  const all = youIfJoin ? [...players, youIfJoin] : players
  const rated = all.filter((p): p is DetailPlayer & { rating: number } => p.rating !== null && Number.isFinite(p.rating))
  const quality = qualityOf(rated.map(p => p.rating))
  const spread = spreadOf(rated.map(p => p.rating))
  const teams = all.length === 4 && rated.length === 4 ? suggestTeams(rated) : null
  return (
    <div className="rounded-xl p-3 mt-3" data-testid="level-details" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
      {all.map(p => {
        const note = p === youIfJoin ? null : matchesText(counts?.[p.id])
        return (
          <div key={p.id} className="flex items-center justify-between py-1.5 text-xs" style={{ borderTop: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{p === youIfJoin ? 'You, if you join' : p.name}{note && <span style={{ color: 'var(--text-subtle)', fontWeight: 400 }}> · {note}</span>}</span>
            <span style={{ color: 'var(--brand-primary-text)', fontWeight: 700 }}>{p.rating !== null && Number.isFinite(p.rating) ? `${levelNumber(p.rating)} · ${skillLabelForRating(p.rating)}` : 'Not rated'}</span>
          </div>
        )
      })}
      {teams && (
        <div className="mt-2.5 pt-2.5" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="text-[10px] font-extrabold uppercase mb-1.5" style={{ letterSpacing: '0.12em', color: 'var(--text-subtle)' }}>Suggested teams</div>
          <div className="grid grid-cols-2 gap-2">
            {[teams.a, teams.b].map((team, i) => (
              <div key={i} className="rounded-lg p-2.5 text-xs" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <div className="text-[10px] font-extrabold uppercase" style={{ color: 'var(--text-subtle)', letterSpacing: '0.12em' }}>Team {i + 1}</div>
                {team.map(p => <div key={p.id} className="flex justify-between mt-1"><span>{p.name}</span><b>{levelNumber(p.rating)}</b></div>)}
                <div className="mt-1.5 pt-1.5 font-bold" style={{ borderTop: '1px solid var(--border)', color: 'var(--brand-primary-text)' }}>Average {(i === 0 ? teams.avgA : teams.avgB).toFixed(2).replace(/0$/, '')}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {quality && spread !== null && (
        <div className="text-[11px] mt-2.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          {QUALITY_LABEL[quality]}. The gap between the strongest and weakest player is {spread.toFixed(1)}.{teams ? ' Pairing the strongest with the weakest keeps it close.' : ''}
        </div>
      )}
    </div>
  )
}

// The heads-up before joining a game well outside your level. A warning, not a block.
function JoinWarningDialog({ warning, rating, range, onCloser, onAnyway, onClose }: { warning: JoinWarning; rating: number; range: string; onCloser: () => void; onAnyway: () => void; onClose: () => void }) {
  const above = warning.direction === 'above'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={above ? 'This game is above your level' : 'This game is below your level'}
      style={{ background: 'rgba(0,0,0,0.55)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl p-5 overflow-y-auto" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', maxHeight: 'calc(100dvh - 2rem)', boxShadow: '0 30px 80px -10px rgba(0,0,0,0.6)' }} onClick={e => e.stopPropagation()}>
        <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{above ? 'This game is above your level' : 'This game is below your level'}</div>
        <p className="text-sm mt-1.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          This one is for {range}. You&apos;re {skillLabelForRating(rating)} ({levelNumber(rating)}), {warning.gap.toFixed(1)} {above ? 'below' : 'above'} its range.{' '}
          {above ? "It may be a tough game, and it can make it harder for the other players." : 'You may find it easy, and the others may find you hard to keep up with.'}
        </p>
        <button onClick={onCloser} className="w-full rounded-xl text-sm font-extrabold mt-4" style={{ minHeight: 48, background: 'var(--brand-primary)', color: 'var(--brand-primary-on)' }}>Show me games closer to my level</button>
        <button onClick={onAnyway} className="w-full rounded-xl text-sm font-bold mt-2.5" style={{ minHeight: 46, background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>Request to join anyway</button>
        <p className="text-xs mt-3 text-center" style={{ color: 'var(--text-subtle)' }}>A warning, not a block. You can always ask to join.</p>
      </div>
    </div>
  )
}

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
  matchCounts = null,
}: {
  matches: OpenMatch[]
  currentUserId: string
  // The viewer's own skill rating and home club, so the list can say which
  // games suit them. Both can be null (never rated, no home club chosen), and
  // then the matching controls simply aren't offered.
  viewerRating: number | null
  homeVenueSlug: string | null
  // Recorded matches per player, to mark a rating Reliable or New. null = unknown.
  matchCounts?: Record<string, number> | null
}) {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [fitsOnly, setFitsOnly] = useState(false)
  const [myClubOnly, setMyClubOnly] = useState(false)
  const [todayOnly, setTodayOnly] = useState(false)
  // The game whose level details are open, and a join the player has been warned about.
  const [openDetails, setOpenDetails] = useState<string | null>(null)
  const [warned, setWarned] = useState<{ match: OpenMatch; warning: JoinWarning } | null>(null)

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

  // A game well outside your level gets a heads-up first. It is a warning, never a block.
  const tryJoin = (match: OpenMatch) => {
    const warning = joinWarning(viewerRating, Number(match.skill_min), Number(match.skill_max))
    if (warning) setWarned({ match, warning })
    else handleRequest(match)
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

  const ratingOf = (r: unknown): number | null => (r !== null && r !== undefined && Number.isFinite(Number(r)) ? Number(r) : null)
  const detailPlayers = (m: OpenMatch): DetailPlayer[] => (m.open_match_players ?? [])
    .filter(p => p.status === 'accepted')
    .map(p => ({ id: p.player_id, name: p.profiles?.nickname ?? p.profiles?.full_name?.split(' ')[0] ?? 'Player', rating: ratingOf(p.profiles?.skill_rating) }))
  // Games to suggest: ones that fit your level and have room, evenly matched first.
  const forYou = rankForYou(ordered.map(m => {
    const players = (m.open_match_players ?? [])
    const spotsLeft = m.spots_total - players.filter(p => p.status === 'accepted').length
    return {
      id: m.id, date: m.date, start_time: m.start_time, venue_slug: m.venue_slug, skill_min: Number(m.skill_min), skill_max: Number(m.skill_max), spotsLeft,
      ratings: detailPlayers(m).map(p => p.rating).filter((r): r is number => r !== null),
      mine: m.organizer_id === currentUserId || players.some(p => p.player_id === currentUserId),
      match: m,
    } as GameLite & { match: OpenMatch }
  }), viewerRating, homeVenueSlug)

  const clearFilters = () => { setFitsOnly(false); setMyClubOnly(false); setTodayOnly(false) }

  return (
    <div>
      {viewerRating !== null && <YourLevelCard rating={viewerRating} matches={matchCounts ? (matchCounts[currentUserId] ?? 0) : null} />}

      {forYou.length > 0 && (
        <section className="mb-5" data-testid="for-you">
          <div className="text-[11px] font-extrabold uppercase mb-2.5 px-0.5" style={{ letterSpacing: '0.14em', color: 'var(--text-subtle)' }}>For you</div>
          <div className="space-y-2.5">
            {forYou.map(g => {
              const m = g.match
              const q = qualityOf([...g.ratings, viewerRating as number])
              return (
                <div key={g.id} className="rounded-2xl p-3.5 flex items-center justify-between gap-3" data-testid="for-you-game"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--brand-primary)', boxShadow: '0 0 0 1px var(--brand-primary-muted), var(--shadow-float)' }}>
                  <div className="min-w-0">
                    <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{dayLabel(m.date)} · {m.start_time.slice(0, 5)} · {getVenue(m.venue_slug).name}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {skillLabelForRange(m.skill_min, m.skill_max)}{m.venue_slug === homeVenueSlug ? ' · Your club' : ''} · {g.spotsLeft} {g.spotsLeft === 1 ? 'spot' : 'spots'} left
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {q && <QualityChip quality={q} title="With you in it" />}
                    <button type="button" onClick={() => tryJoin(m)} disabled={loading === m.id + '-request'}
                      className="rounded-full px-3.5 text-xs font-extrabold disabled:opacity-60" style={{ minHeight: 40, background: 'var(--brand-primary)', color: 'var(--brand-primary-on)' }}>
                      Request to join
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

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
              const canJoinView = !myEntry && !isOrganizer && spotsLeft > 0
              const youIfJoin: DetailPlayer | null = canJoinView && viewerRating !== null ? { id: currentUserId, name: 'You', rating: viewerRating } : null
              const levelPlayers = detailPlayers(match)
              const quality = qualityOf([...levelPlayers.map(p => p.rating).filter((r): r is number => r !== null), ...(youIfJoin ? [viewerRating as number] : [])])

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
                    {quality && <QualityChip quality={quality} title={youIfJoin ? 'With you in it' : undefined} />}
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

                  {levelPlayers.length > 0 && (
                    <div>
                      <button type="button" aria-expanded={openDetails === match.id} onClick={() => setOpenDetails(openDetails === match.id ? null : match.id)}
                        className="text-xs font-bold mt-3" style={{ color: 'var(--brand-primary-text)' }}>
                        {openDetails === match.id ? 'Hide level details' : 'Level details'}
                      </button>
                      {openDetails === match.id && <LevelDetails players={levelPlayers} counts={matchCounts} youIfJoin={youIfJoin} />}
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
                        onClick={() => tryJoin(match)}
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

      {warned && viewerRating !== null && (
        <JoinWarningDialog warning={warned.warning} rating={viewerRating} range={skillLabelForRange(warned.match.skill_min, warned.match.skill_max)}
          onClose={() => setWarned(null)}
          onCloser={() => { setFitsOnly(true); setWarned(null) }}
          onAnyway={() => { const m = warned.match; setWarned(null); void handleRequest(m) }} />
      )}
    </div>
  )
}
