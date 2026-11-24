// The club owner's player list: who they are, when they last played, what they have booked, and the groups worth acting on
// (members, owes money, new, quiet for 30 days). Pure functions of their inputs, so the groups are tested without a database.
// Everything here comes from bookings already in the system; nothing is estimated.

export const QUIET_DAYS = 30
export const NEW_DAYS = 30

export type ClubPlayer = {
  id: string
  name: string
  member: boolean            // on a paid plan at this club
  planLabel: string | null
  lastPlayed: string | null  // YYYY-MM-DD of their latest game at this club that has already happened
  games: number              // games they have played at this club
  booked: number             // the court value of those games (what they booked, not what they paid after splits)
  owes: number               // how many shares of other people's games they have not paid yet
  joined: string | null      // YYYY-MM-DD they signed up
  viaLink?: boolean          // signed up through this club's booking link
}

export type Segment = 'all' | 'members' | 'owes' | 'new' | 'link' | 'quiet'
export const SEGMENTS: { key: Segment; label: string; short: string }[] = [
  { key: 'all', label: 'All', short: 'All' },
  { key: 'members', label: 'Club members', short: 'Members' },
  { key: 'owes', label: 'Owes money', short: 'Owes' },
  { key: 'new', label: 'New this month', short: 'New' },
  { key: 'link', label: 'Joined via link', short: 'Via link' },
  { key: 'quiet', label: 'Not played in 30 days', short: '30 days' },
]

const dayMs = 86400000
const toMs = (d: string) => Date.parse(`${d}T12:00:00Z`)

// Whole days from `date` to `today` (both YYYY-MM-DD in the club's own clock).
export const daysSince = (date: string, today: string): number => Math.round((toMs(today) - toMs(date)) / dayMs)

// Played here before, and not for 30 days or more. Someone who has never played is not "quiet", they are new.
export const isQuiet = (p: ClubPlayer, today: string): boolean => !!p.lastPlayed && daysSince(p.lastPlayed, today) >= QUIET_DAYS
export const isNew = (p: ClubPlayer, today: string): boolean => !!p.joined && daysSince(p.joined, today) < NEW_DAYS

export function inSegment(p: ClubPlayer, s: Segment, today: string): boolean {
  switch (s) {
    case 'members': return p.member
    case 'owes': return p.owes > 0
    case 'new': return isNew(p, today)
    case 'link': return !!p.viaLink
    case 'quiet': return isQuiet(p, today)
    default: return true
  }
}

export const filterPlayers = (players: ClubPlayer[], s: Segment, today: string): ClubPlayer[] => players.filter(p => inSegment(p, s, today))

export function countSegments(players: ClubPlayer[], today: string): Record<Segment, number> {
  const out = { all: 0, members: 0, owes: 0, new: 0, link: 0, quiet: 0 } as Record<Segment, number>
  for (const p of players) for (const s of SEGMENTS) if (inSegment(p, s.key, today)) out[s.key]++
  return out
}

// Search by name, ignoring case.
export const matchesQuery = (p: ClubPlayer, q: string): boolean => !q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase())

// A short sentence for the list: "34 days ago", "today", "never".
export function lastPlayedLabel(p: ClubPlayer, today: string): string {
  if (!p.lastPlayed) return 'Not played yet'
  const d = daysSince(p.lastPlayed, today)
  if (d <= 0) return 'Played today'
  if (d === 1) return 'Yesterday'
  if (d >= 365) return 'Over a year ago'
  return `${d} days ago`
}

// Quietest first, so the people who have been away longest are at the top of that group.
export function sortFor(players: ClubPlayer[], s: Segment): ClubPlayer[] {
  const copy = [...players]
  if (s === 'quiet') return copy.sort((a, b) => (a.lastPlayed ?? '').localeCompare(b.lastPlayed ?? ''))
  if (s === 'owes') return copy.sort((a, b) => b.owes - a.owes)
  if (s === 'new') return copy.sort((a, b) => (b.joined ?? '').localeCompare(a.joined ?? ''))
  return copy.sort((a, b) => (b.lastPlayed ?? '').localeCompare(a.lastPlayed ?? '') || a.name.localeCompare(b.name))
}

export const groupBooked = (players: ClubPlayer[]): number => Math.round(players.reduce((t, p) => t + p.booked, 0) * 100) / 100
