// The rules of tournament formats, as pure functions (no database, no clock, and any
// randomness comes from a function you pass in, so everything here is testable):
// making pairs, round-robin schedules, groups, standings, knockout brackets (with byes
// and an optional third-place match) and fair partner rotation for Americano days.
// The server (lib/tournament-server.ts) feeds it what is in the database and saves what
// it returns.

export type Rng = () => number

// A small seeded generator, so a draw can be reproduced in tests.
export function seededRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffleWith<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ------------------------------------------------------------------------ pairs

export type Rated = { id: string; rating: number | null }

// Two players per pair. "balanced" pairs the strongest with the weakest, the next
// strongest with the next weakest, and so on, so the pairs are as even as they can be.
// Players with no rating count as the middle of the field. Needs an even number.
export function makePairs(players: Rated[], mode: 'random' | 'balanced', rng: Rng): [string, string][] {
  if (players.length % 2 !== 0) throw new Error('An even number of players is needed to make pairs')
  if (mode === 'random') {
    const s = shuffleWith(players.map(p => p.id), rng)
    return Array.from({ length: s.length / 2 }, (_, i) => [s[2 * i], s[2 * i + 1]] as [string, string])
  }
  const known = players.map(p => p.rating).filter((r): r is number => typeof r === 'number').sort((a, b) => a - b)
  const middle = known.length ? known[Math.floor(known.length / 2)] : 3
  const ranked = [...players].map(p => ({ id: p.id, r: p.rating ?? middle })).sort((a, b) => b.r - a.r || a.id.localeCompare(b.id))
  const n = ranked.length
  return Array.from({ length: n / 2 }, (_, i) => [ranked[i].id, ranked[n - 1 - i].id] as [string, string])
}

// ---------------------------------------------------------------------- standings

export type Result = { a: string; b: string; sa: number; sb: number } // completed matches only
export type Standing = { id: string; played: number; won: number; drawn: number; lost: number; gf: number; ga: number; diff: number; points: number; rank: number }

// Win 3, draw 1, loss 0. Ties are broken by points, then game difference, then games
// won, then (for exactly two level) who won when they met, then the original seed.
export function standings(ids: string[], results: Result[], seed: Record<string, number> = {}): Standing[] {
  const rows = new Map<string, Standing>(ids.map(id => [id, { id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, diff: 0, points: 0, rank: 0 }]))
  for (const r of results) {
    const A = rows.get(r.a), B = rows.get(r.b)
    if (!A || !B) continue
    A.played++; B.played++; A.gf += r.sa; A.ga += r.sb; B.gf += r.sb; B.ga += r.sa
    if (r.sa > r.sb) { A.won++; B.lost++; A.points += 3 } else if (r.sb > r.sa) { B.won++; A.lost++; B.points += 3 } else { A.drawn++; B.drawn++; A.points++; B.points++ }
  }
  for (const s of Array.from(rows.values())) s.diff = s.gf - s.ga
  const headToHead = (x: string, y: string): number => {
    const m = results.find(r => (r.a === x && r.b === y) || (r.a === y && r.b === x))
    if (!m || m.sa === m.sb) return 0
    const xWon = m.a === x ? m.sa > m.sb : m.sb > m.sa
    return xWon ? -1 : 1
  }
  const key = (s: Standing) => [s.points, s.diff, s.gf]
  const sorted = Array.from(rows.values()).sort((p, q) => {
    const kp = key(p), kq = key(q)
    for (let i = 0; i < kp.length; i++) if (kp[i] !== kq[i]) return kq[i] - kp[i]
    return (seed[p.id] ?? 1e9) - (seed[q.id] ?? 1e9) || p.id.localeCompare(q.id)
  })
  // exactly two level on every measure: the head-to-head result decides
  for (let i = 0; i < sorted.length - 1; i++) {
    const p = sorted[i], q = sorted[i + 1]
    const level = key(p).every((v, k) => v === key(q)[k])
    const prev = i > 0 && key(sorted[i - 1]).every((v, k) => v === key(p)[k])
    const next = i + 2 < sorted.length && key(sorted[i + 2]).every((v, k) => v === key(q)[k])
    if (level && !prev && !next && headToHead(p.id, q.id) > 0) { sorted[i] = q; sorted[i + 1] = p }
  }
  sorted.forEach((s, i) => { s.rank = i + 1 })
  return sorted
}

// ------------------------------------------------------------------ round robin

// Every entry plays every other once (the "circle method"). With an odd number one
// entry sits out each round; that sitting-out is not returned as a match.
export function roundRobinRounds(ids: string[]): [string, string][][] {
  if (ids.length < 2) return []
  const list: (string | null)[] = [...ids]
  if (list.length % 2 === 1) list.push(null)
  const n = list.length
  const rounds: [string, string][][] = []
  for (let r = 0; r < n - 1; r++) {
    const round: [string, string][] = []
    for (let i = 0; i < n / 2; i++) {
      const a = list[i], b = list[n - 1 - i]
      if (a !== null && b !== null) round.push(r % 2 === 0 || i > 0 ? [a, b] : [b, a])
    }
    rounds.push(round)
    list.splice(1, 0, list.pop() as string | null) // rotate everyone but the first
  }
  return rounds
}

// ---------------------------------------------------------------------- groups

// Entries are given best seed first. Groups are filled in a snake (1 2 3 3 2 1 ...), so
// the strongest entries are spread out and the groups are as even as they can be.
export function groupCount(entries: number, groupSize: number): number {
  return Math.max(1, Math.round(entries / Math.max(2, groupSize)))
}
export function buildGroups(idsBySeed: string[], groupSize: number): string[][] {
  const g = groupCount(idsBySeed.length, groupSize)
  const groups: string[][] = Array.from({ length: g }, () => [])
  idsBySeed.forEach((id, i) => {
    const lap = Math.floor(i / g), pos = i % g
    groups[lap % 2 === 0 ? pos : g - 1 - pos].push(id)
  })
  return groups
}
export const groupLabel = (i: number): string => String.fromCharCode(65 + i)

// --------------------------------------------------------------------- knockout

export const bracketSize = (n: number): number => { let s = 2; while (s < n) s *= 2; return s }

// The classic seeding order: 1 plays the lowest seed, and the top seeds can only meet
// late. For 8: [1, 8, 4, 5, 2, 7, 3, 6].
export function seedOrder(size: number): number[] {
  let order = [1, 2]
  while (order.length < size) {
    const n = order.length * 2
    order = order.flatMap(s => [s, n + 1 - s])
  }
  return order
}

export type Slot = string | null // null = a bye

// seededIds: best seed first. A seed beyond the number of entries is a bye, so the
// top seeds skip round one.
export function firstRoundSlots(seededIds: string[]): Slot[] {
  const size = bracketSize(seededIds.length)
  return seedOrder(size).map(seed => (seed <= seededIds.length ? seededIds[seed - 1] : null))
}

// Same-group entries should not meet in round one if it can be helped. `groupOf` maps an
// entry to its group; clashing slots are swapped with a slot elsewhere that fixes it.
export function separateGroupsInRoundOne(slots: Slot[], groupOf: Record<string, string>): Slot[] {
  const s = [...slots]
  const clash = (k: number) => { const a = s[2 * k], b = s[2 * k + 1]; return !!a && !!b && groupOf[a] === groupOf[b] }
  const pairs = s.length / 2
  for (let k = 0; k < pairs; k++) {
    if (!clash(k)) continue
    for (let j = 0; j < pairs; j++) {
      if (j === k) continue
      for (const [ik, ij] of [[2 * k + 1, 2 * j], [2 * k + 1, 2 * j + 1]] as [number, number][]) {
        const a = s[ik], b = s[ij]
        if (!a || !b) continue
        ;[s[ik], s[ij]] = [b, a]
        if (!clash(k) && !clash(j)) { j = pairs; break }
        ;[s[ik], s[ij]] = [a, b]
      }
    }
  }
  return s
}

export const knockoutRoundName = (slotCount: number): string =>
  slotCount === 2 ? 'Final' : slotCount === 4 ? 'Semi-final' : slotCount === 8 ? 'Quarter-final' : `Round of ${slotCount}`

export type KoMatch = { k: number; a: string; b: string; winner: string | null; loser: string | null; extra?: 'third_place' }
export type KoPlan =
  | { action: 'generate'; round: number; label: string; matches: { k: number; a: string; b: string; extra?: 'third_place' }[]; byes: string[] }
  | { action: 'wait'; round: number }
  | { action: 'done'; champion: string; runnerUp: string | null }

// Where a knockout stands. `played[r]` holds the matches made so far for bracket round r
// (1-based) with their winners (null while unplayed). It says what to do next: make this
// round's matches, wait for scores, or the bracket is finished.
export function planKnockout(seededIds: string[], played: Record<number, KoMatch[]>, opts: { thirdPlace?: boolean; groupOf?: Record<string, string> } = {}): KoPlan {
  if (seededIds.length < 2) throw new Error('A knockout needs at least two entries')
  let slots = firstRoundSlots(seededIds)
  if (opts.groupOf) slots = separateGroupsInRoundOne(slots, opts.groupOf)
  let round = 1
  for (;;) {
    const pairs = Array.from({ length: slots.length / 2 }, (_, k) => [slots[2 * k], slots[2 * k + 1]] as [Slot, Slot])
    const made = played[round]
    if (!made || made.length === 0) {
      const matches = pairs.map(([a, b], k) => (a && b ? { k, a, b } : null)).filter(Boolean) as { k: number; a: string; b: string; extra?: 'third_place' }[]
      const byes = pairs.filter(([a, b]) => !!a !== !!b).map(([a, b]) => (a ?? b) as string)
      if (slots.length === 2 && opts.thirdPlace && round > 1) {
        const semis = played[round - 1] ?? []
        const losers = semis.filter(m => m.loser).map(m => m.loser as string)
        if (semis.length === 2 && losers.length === 2) matches.push({ k: 1, a: losers[0], b: losers[1], extra: 'third_place' })
      }
      return { action: 'generate', round, label: knockoutRoundName(slots.length), matches, byes }
    }
    if (made.some(m => m.winner === null)) return { action: 'wait', round }
    const mainMade = made.filter(m => !m.extra)
    const next: Slot[] = pairs.map(([a, b], k) => {
      if (a && b) return mainMade.find(m => m.k === k)?.winner ?? null
      return a ?? b
    })
    if (next.length === 1) {
      const final = mainMade[0]
      return { action: 'done', champion: next[0] as string, runnerUp: final?.loser ?? null }
    }
    slots = next
    round++
  }
}

// ------------------------------------------------------------ Americano rotation

export type History = { partners: Record<string, number>; opponents: Record<string, number>; sat: Record<string, number> }
export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)

export function emptyHistory(): History { return { partners: {}, opponents: {}, sat: {} } }

export function addToHistory(h: History, m: { team1: [string, string]; team2: [string, string] }, sitting: string[] = []) {
  const bump = (rec: Record<string, number>, k: string) => { rec[k] = (rec[k] ?? 0) + 1 }
  bump(h.partners, pairKey(m.team1[0], m.team1[1])); bump(h.partners, pairKey(m.team2[0], m.team2[1]))
  for (const a of m.team1) for (const b of m.team2) bump(h.opponents, pairKey(a, b))
  for (const s of sitting) bump(h.sat, s)
}

// One round of an Americano: groups of four, two against two. Tries many arrangements
// and keeps the one that repeats the fewest partners (heavily), then the fewest
// opponents. Whoever has sat out the most already is picked to play; the rest sit out.
export function americanoRound(playerIds: string[], courts: number, history: History, rng: Rng, attempts = 400): { pairings: { team1: [string, string]; team2: [string, string] }[]; sittingOut: string[] } {
  const groups = Math.min(Math.floor(playerIds.length / 4), courts)
  if (groups === 0) return { pairings: [], sittingOut: [...playerIds] }
  const need = groups * 4
  // who sits out: whoever has sat out the most already is picked to play first
  const order = shuffleWith(playerIds, rng).sort((a, b) => (history.sat[b] ?? 0) - (history.sat[a] ?? 0))
  const playing = order.slice(0, need), sitting = order.slice(need)
  let best: { cost: number; pairings: { team1: [string, string]; team2: [string, string] }[] } | null = null
  for (let t = 0; t < attempts; t++) {
    const s = shuffleWith(playing, rng)
    const pairings: { team1: [string, string]; team2: [string, string] }[] = []
    let cost = 0
    for (let g = 0; g < groups; g++) {
      const [a, b, c, d] = s.slice(g * 4, g * 4 + 4)
      pairings.push({ team1: [a, b], team2: [c, d] })
      cost += 100 * ((history.partners[pairKey(a, b)] ?? 0) + (history.partners[pairKey(c, d)] ?? 0))
      for (const x of [a, b]) for (const y of [c, d]) cost += history.opponents[pairKey(x, y)] ?? 0
    }
    if (!best || cost < best.cost) best = { cost, pairings }
    if (cost === 0) break
  }
  return { pairings: best!.pairings, sittingOut: sitting }
}

// ----------------------------------------------------------------- scheduling

// Assigns courts in turn and a "wave" (which batch of matches on those courts), so a
// round with more matches than courts says what plays first.
export function assignCourts<T>(items: T[], courtIds: string[]): (T & { court_id: string; wave: number })[] {
  return items.map((it, i) => ({ ...it, court_id: courtIds[i % courtIds.length], wave: Math.floor(i / courtIds.length) + 1 }))
}
