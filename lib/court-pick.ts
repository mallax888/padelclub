// Choosing your own court when you book. Courts are always shown in number order, and laid out the way the club's
// courts really sit (two across and two down, or three in a row) wherever the club has told us that. Pure functions,
// so the order and the layout are tested without a browser.

export type NamedCourt = { name: string }
export type ListedPosition = { name: string; x: number; y: number }
export type LayoutCell<C> = { court: C; col: number; row: number }
export type CourtLayout<C> = { cols: number; rows: number; cells: LayoutCell<C>[]; fromVenue: boolean }

const key = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ')

// "Court 3" -> 3. A court with no number in its name has none.
export function courtNumber(name: string): number | null {
  const m = name.match(/(\d+)/)
  return m ? Number(m[1]) : null
}

// Number order: Court 2 before Court 10, and names without a number after the numbered ones.
export function sortCourts<C extends NamedCourt>(courts: C[]): C[] {
  return [...courts].sort((a, b) => {
    const na = courtNumber(a.name), nb = courtNumber(b.name)
    if (na !== null && nb !== null && na !== nb) return na - nb
    if (na !== null && nb === null) return -1
    if (na === null && nb !== null) return 1
    return a.name.localeCompare(b.name, undefined, { numeric: true })
  })
}

// Where each court sits on the floor. `listed` is the club's own court positions (x across, y down). When every
// court has a position, that is the layout. Otherwise (a new club that has not set one) the courts go in number order,
// filling rows: a single row for up to three courts, two across for four, three across for more.
export function courtLayout<C extends NamedCourt>(courts: C[], listed?: ListedPosition[] | null): CourtLayout<C> {
  const sorted = sortCourts(courts)
  if (sorted.length === 0) return { cols: 0, rows: 0, cells: [], fromVenue: false }
  if (listed && listed.length > 0) {
    const at = new Map(listed.map(p => [key(p.name), p]))
    const found = sorted.map(c => at.get(key(c.name)))
    if (found.every(Boolean)) {
      const xs = Array.from(new Set(found.map(p => p!.x))).sort((a, b) => a - b)
      const ys = Array.from(new Set(found.map(p => p!.y))).sort((a, b) => a - b)
      const clash = new Set(found.map(p => `${p!.x},${p!.y}`)).size !== found.length
      if (!clash && xs.length <= 4) {
        return {
          cols: xs.length, rows: ys.length, fromVenue: true,
          cells: sorted.map((court, i) => ({ court, col: xs.indexOf(found[i]!.x), row: ys.indexOf(found[i]!.y) })),
        }
      }
    }
  }
  const n = sorted.length
  const cols = n <= 3 ? n : n === 4 ? 2 : 3
  return { cols, rows: Math.ceil(n / cols), fromVenue: false, cells: sorted.map((court, i) => ({ court, col: i % cols, row: Math.floor(i / cols) })) }
}
