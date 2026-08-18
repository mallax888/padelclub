export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Random 2v2 groupings for one Americano round. Doesn't track partner
// history across rounds yet (a fast-follow), so the same two players can
// end up paired again -- acceptable for a v1 social tournament. Caps the
// number of groups to whichever is smaller, players available or courts
// available; anyone left over sits out that round.
export function pairAmericanoRound(playerIds: string[], courtIds: string[]) {
  const shuffled = shuffle(playerIds)
  const maxGroups = Math.min(Math.floor(shuffled.length / 4), courtIds.length)
  const pairings: { courtId: string; team1: [string, string]; team2: [string, string] }[] = []
  for (let g = 0; g < maxGroups; g++) {
    const group = shuffled.slice(g * 4, g * 4 + 4)
    pairings.push({
      courtId: courtIds[g],
      team1: [group[0], group[1]],
      team2: [group[2], group[3]],
    })
  }
  const sittingOut = shuffled.slice(maxGroups * 4)
  return { pairings, sittingOut }
}
