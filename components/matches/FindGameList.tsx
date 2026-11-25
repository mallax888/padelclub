'use client'

import { fmtClock } from '@/lib/clock'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { formatDate, getInitials, localDateStr } from '@/lib/utils'
import { skillLabelForRating } from '@/lib/skill-levels'
import {
  joinWarning, levelFit, levelNumber, qualityOf, QUALITY_LABEL, reliabilityOf, spreadOf, suggestTeams,
  RELIABLE_MATCHES, type JoinWarning, type Quality,
} from '@/lib/matchmaking'
import { getVenue } from '@/lib/venues'
import { timezoneForVenueSlug, venueInstant } from '@/lib/timezone'
import MoneyBubble from '@/components/ui/MoneyBubble'

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
const FIT_LABEL = { fits: 'Fits you', above: 'A step up', below: 'Easier game' } as const
const FIT_KIND = { fits: 'gain', above: 'wait', below: 'none' } as const

// The level scale every bar on this page uses (ratings run from about 0.5 to 7).
const pos = (r: number) => Math.min(Math.max(((r - 0.5) / 6.5) * 100, 0), 100)
const TILE = 'linear-gradient(160deg, #3a73dc, #1d3f8d)'
const TILE_SHADOW = 'inset 0 1px 0 rgba(255,255,255,0.28), 0 6px 14px rgba(11,30,74,0.35)'

// A bar along the level scale: the game's range in blue, and where you sit as a white marker.
function LevelBar({ min, max, you, testId }: { min: number; max: number; you: number | null; testId?: string }) {
  return (
    <div className="relative h-2 rounded-full my-2.5" data-testid={testId} style={{ background: 'var(--bg-raised)' }}>
      <span className="absolute top-0 bottom-0 rounded-full" style={{ left: `${pos(min)}%`, width: `${Math.max(pos(max) - pos(min), 3)}%`, background: TILE }} />
      {you !== null && <span className="absolute rounded-full" aria-hidden style={{ left: `calc(${pos(you)}% - 7px)`, top: -4, width: 14, height: 16, background: '#ffffff', boxShadow: '0 0 0 3px var(--bg-surface)' }} />}
    </div>
  )
}

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
    <div className="rounded-[20px] p-4 mb-4" data-testid="your-level" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
      <div className="flex items-center gap-3.5">
        <span className="inline-flex flex-col items-center justify-center text-white shrink-0" style={{ width: 66, height: 60, borderRadius: 16, background: TILE, boxShadow: TILE_SHADOW, lineHeight: 1 }}>
          <span className="font-black" style={{ fontSize: 8.5, letterSpacing: '0.12em', color: '#dbe7ff', marginBottom: 3 }}>LEVEL</span>
          <span className="font-black" style={{ fontSize: 24 }}>{levelNumber(rating)}</span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-extrabold uppercase" style={{ letterSpacing: '0.12em', color: 'var(--label-blue, var(--brand-primary-text))' }}>Your level</div>
          <div className="text-[19px] font-extrabold leading-tight" style={{ color: 'var(--text-primary)' }}>{skillLabelForRating(rating)}</div>
        </div>
        {reliability && <MoneyBubble kind={reliability === 'reliable' ? 'gain' : 'none'} size={11} testId="reliability">{reliability === 'reliable' ? 'Reliable' : 'New'}</MoneyBubble>}
      </div>
      <LevelBar min={rating} max={rating} you={rating} />
      <div className="flex justify-between text-[10px] font-bold" style={{ color: 'var(--text-primary)' }}>{TIERS.map(t => <span key={t}>{t}</span>)}</div>
      <div className="text-xs mt-2.5 leading-relaxed font-semibold" style={{ color: 'var(--text-primary)' }}>
        {matches === null ? 'Your level moves as you record matches.'
          : matches >= RELIABLE_MATCHES ? `From your last ${matches} recorded matches. Win an even game and it moves up.`
          : matches === 0 ? "You haven't recorded a match yet, so this is the level you chose. It moves as you play."
          : `Based on ${matches} recorded ${matches === 1 ? 'match' : 'matches'} so far. It settles after ${RELIABLE_MATCHES}.`}
        {' '}<Link href="/record-match" style={{ color: 'var(--brand-primary-text)', fontWeight: 800, textDecoration: 'underline' }}>Record a match</Link>
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
    <div className="rounded-[16px] p-3 mt-3" data-testid="level-details" style={{ background: 'var(--bg-raised)' }}>
      {all.map(p => {
        const note = p === youIfJoin ? null : matchesText(counts?.[p.id])
        return (
          <div key={p.id} className="flex items-center justify-between py-1.5 text-xs" style={{ borderTop: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{p === youIfJoin ? 'You, if you join' : p.name}{note && <span style={{ color: 'var(--text-primary)', opacity: 0.8, fontWeight: 500 }}> · {note}</span>}</span>
            <span style={{ color: 'var(--brand-primary-text)', fontWeight: 700 }}>{p.rating !== null && Number.isFinite(p.rating) ? `${levelNumber(p.rating)} · ${skillLabelForRating(p.rating)}` : 'Not rated'}</span>
          </div>
        )
      })}
      {teams && (
        <div className="mt-2.5 pt-2.5" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="text-[10px] font-extrabold uppercase mb-1.5" style={{ letterSpacing: '0.12em', color: 'var(--label-blue, var(--brand-primary-text))' }}>Teams if everyone plays</div>
          <div className="grid grid-cols-2 gap-2">
            {[teams.a, teams.b].map((team, i) => (
              <div key={i} className="rounded-[12px] p-2.5 text-xs" style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)' }}>
                <div className="text-[10px] font-extrabold uppercase" style={{ color: 'var(--label-blue, var(--brand-primary-text))', letterSpacing: '0.12em' }}>Team {i + 1}</div>
                {team.map(p => <div key={p.id} className="flex justify-between mt-1"><span>{p.name}</span><b>{levelNumber(p.rating)}</b></div>)}
                <div className="mt-1.5 pt-1.5 font-bold" style={{ borderTop: '1px solid var(--border)', color: 'var(--brand-primary-text)' }}>Average {(i === 0 ? teams.avgA : teams.avgB).toFixed(2).replace(/0$/, '')}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {quality && spread !== null && (
        <div className="text-[11px] mt-2.5 leading-relaxed font-semibold" style={{ color: 'var(--text-primary)' }}>
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
      className="inline-flex items-center text-[13px] font-extrabold px-4 rounded-full whitespace-nowrap"
      style={on
        ? { minHeight: 38, background: 'var(--today-block-bg)', color: 'var(--today-block-fg)', boxShadow: 'var(--today-block-shadow)', border: '1px solid transparent' }
        : { minHeight: 38, background: 'var(--bg-raised)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
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
  const clearFilters = () => { setFitsOnly(false); setMyClubOnly(false); setTodayOnly(false) }

  return (
    <div>
      {viewerRating !== null && <YourLevelCard rating={viewerRating} matches={matchCounts ? (matchCounts[currentUserId] ?? 0) : null} />}

      <div className="flex flex-wrap gap-2 mb-5" data-testid="open-play-filters">
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
          <div className="text-[11.5px] font-extrabold uppercase mb-2.5 px-0.5" data-testid="open-play-day"
            style={{ letterSpacing: '0.14em', color: 'var(--text-primary)' }}>
            {dayLabel(day.date)}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

              const [hh, ap] = fmtClock(match.start_time).split(' ')
              const open = openDetails === match.id
              const rangeText = skillLabelForRange(match.skill_min, match.skill_max)
              const action = isOrganizer ? null
                : myEntry?.status === 'accepted' ? (
                  <button type="button" className="rounded-full px-4 text-[13px] font-extrabold shrink-0" style={{ minHeight: 38, background: 'transparent', color: '#ff8a8f', border: '1px solid rgba(255,138,143,0.5)' }}
                    disabled={loading === match.id + '-leave'} onClick={() => handleLeave(match.id)}>{loading === match.id + '-leave' ? '…' : 'Leave match'}</button>
                ) : myEntry?.status === 'pending' ? (
                  <span className="rounded-full px-3.5 inline-flex items-center text-[12px] font-extrabold shrink-0" style={{ minHeight: 34, background: 'var(--bg-raised)', color: 'var(--text-primary)' }}>Request pending</span>
                ) : (
                  <button type="button" aria-label={isFull ? 'Match full' : 'Request to join'} data-testid="join"
                    className="rounded-full px-5 text-[13.5px] font-black shrink-0 disabled:opacity-50"
                    style={isFull ? { minHeight: 40, background: 'var(--bg-raised)', color: 'var(--text-primary)' } : { minHeight: 40, background: 'var(--today-block-bg)', color: 'var(--today-block-fg)', boxShadow: 'var(--today-block-shadow)' }}
                    disabled={isFull || loading === match.id + '-request'} onClick={() => tryJoin(match)}>
                    {loading === match.id + '-request' ? '…' : isFull ? 'Full' : 'Join'}
                  </button>
                )

              return (
                <div key={match.id} className="rounded-[20px] p-5" data-testid="open-game" data-fit={fit ?? undefined}
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
                  {/* The time in a blue tile, like the courts; the court, the club and the kind of game beside it. */}
                  <div className="flex items-center gap-3">
                    <span className="inline-flex flex-col items-center justify-center text-white shrink-0" data-testid="game-time"
                      style={{ width: 62, height: 56, borderRadius: 15, background: TILE, boxShadow: TILE_SHADOW, lineHeight: 1 }}>
                      <span className="font-black" style={{ fontSize: hh.length > 4 ? 17 : 19 }}>{hh}</span>
                      <span className="font-black" style={{ fontSize: 9.5, letterSpacing: '0.1em', marginTop: 3, color: '#dbe7ff' }}>{(ap ?? '').toUpperCase()}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[15px] font-extrabold truncate" style={{ color: 'var(--text-primary)' }}>{match.courts?.name}</span>
                        {isOrganizer ? <span className="text-[11.5px] font-black rounded-full px-2.5 py-0.5 shrink-0" style={{ background: 'var(--today-block-bg)', color: 'var(--today-block-fg)' }}>Your game</span>
                          : fit ? <MoneyBubble kind={FIT_KIND[fit]} size={11.5} testId="fit">{FIT_LABEL[fit]}</MoneyBubble> : null}
                      </div>
                      <div className="text-[12.5px] font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>
                        {venue.name} · until {fmtClock(match.end_time)} · <span className="capitalize" style={match.match_type === 'competitive' ? { color: 'var(--busy-amber)', fontWeight: 800 } : undefined}>{match.match_type}</span>
                      </div>
                    </div>
                  </div>

                  {match.notes && <div className="text-[12.5px] font-semibold italic mt-2 truncate" style={{ color: 'var(--text-primary)' }}>&ldquo;{match.notes}&rdquo;</div>}
                  <LevelBar min={Number(match.skill_min)} max={Number(match.skill_max)} you={viewerRating} testId="game-level-bar" />
                  <div className="flex items-center justify-between text-[12px] font-extrabold">
                    <span style={{ color: isFull ? 'var(--text-primary)' : 'var(--brand-primary-text)' }}>{isFull ? 'Full' : `${spotsLeft} ${spotsLeft === 1 ? 'spot' : 'spots'} left`}</span>
                    <span style={{ color: 'var(--text-primary)' }}>{rangeText}</span>
                  </div>

                  {/* Who is in, each with their level, the open seats, and the one action. */}
                  <div className="flex items-end gap-2.5 mt-3">
                    {acceptedPlayers.map(p => {
                      const r = ratingOf(p.profiles?.skill_rating)
                      return (
                        <span key={p.player_id} className="inline-flex flex-col items-center gap-1" data-testid="game-player" title={p.profiles?.nickname ?? p.profiles?.full_name ?? 'Player'}>
                          <span className="w-[34px] h-[34px] rounded-full inline-flex items-center justify-center text-[11.5px] font-extrabold text-white" style={{ background: TILE }}>{getInitials(p.profiles?.full_name ?? '?')}</span>
                          <span className="text-[10px] font-extrabold" style={{ color: 'var(--text-primary)' }}>{r !== null ? levelNumber(r) : '–'}</span>
                        </span>
                      )
                    })}
                    {Array.from({ length: Math.max(spotsLeft, 0) }).map((_, i) => (
                      <span key={`empty-${i}`} className="inline-flex flex-col items-center gap-1">
                        <span className="w-[34px] h-[34px] rounded-full inline-flex items-center justify-center text-[14px] font-extrabold" style={{ border: '1.5px dashed var(--text-subtle)', color: 'var(--text-primary)' }}>+</span>
                        <span className="text-[10px] font-extrabold" style={{ color: 'var(--text-primary)', opacity: 0.75 }}>open</span>
                      </span>
                    ))}
                    <span className="flex-1" />
                    {action}
                  </div>

                  {/* Pending requests: only the organiser sees these, right on the card. */}
                  {isOrganizer && pendingPlayers.length > 0 && (
                    <div className="rounded-[16px] p-3 mt-3" style={{ background: 'var(--bg-raised)' }}>
                      <div className="text-[11px] font-extrabold uppercase mb-2" style={{ letterSpacing: '0.12em', color: 'var(--label-blue, var(--brand-primary-text))' }}>
                        {pendingPlayers.length} pending request{pendingPlayers.length > 1 ? 's' : ''}
                      </div>
                      {pendingPlayers.map(p => (
                        <div key={p.player_id} className="py-1.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-8 h-8 rounded-full inline-flex items-center justify-center text-[11px] font-extrabold text-white shrink-0" style={{ background: TILE }}>{getInitials(p.profiles?.full_name ?? '?')}</span>
                            <div className="min-w-0">
                              <div className="text-[13.5px] font-extrabold truncate" style={{ color: 'var(--text-primary)' }}>{p.profiles?.nickname ?? p.profiles?.full_name ?? 'Player'}</div>
                              <div className="text-[11.5px] font-semibold" style={{ color: 'var(--text-primary)' }}>{skillLabelForRating(p.profiles?.skill_rating)}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 mt-2">
                            <button className="rounded-full px-4 text-[13px] font-black" style={{ minHeight: 36, background: 'var(--today-block-bg)', color: 'var(--today-block-fg)' }}
                              disabled={loading === match.id + '-' + p.player_id} onClick={() => handleResponse(match, p.player_id, true)}>Accept</button>
                            <button className="text-[13px] font-extrabold px-1" style={{ minHeight: 36, color: '#ff8a8f' }}
                              disabled={loading === match.id + '-' + p.player_id} onClick={() => handleResponse(match, p.player_id, false)}>Decline</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {levelPlayers.length > 0 && (
                    <div className="mt-2.5">
                      <button type="button" aria-expanded={open} aria-label={open ? 'Hide level details' : 'Level details'} onClick={() => setOpenDetails(open ? null : match.id)}
                        className="text-[12.5px] font-extrabold inline-flex items-center gap-1.5" style={{ color: 'var(--brand-primary-text)' }}>
                        {open ? 'Hide players and teams' : 'Players and teams'}
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : undefined }}><path d="M6 9l6 6 6-6" /></svg>
                      </button>
                      {open && (
                        <>
                          {quality && <div className="mt-2"><QualityChip quality={quality} title={youIfJoin ? 'With you in it' : undefined} /></div>}
                          {levelPlayers.length > 0 && <LevelDetails players={levelPlayers} counts={matchCounts} youIfJoin={youIfJoin} />}
                                                </>
                      )}
                    </div>
                  )}
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
