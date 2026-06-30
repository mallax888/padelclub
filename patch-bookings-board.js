const fs = require('fs');

// Update the page to also pass venue info
let page = fs.readFileSync('app/(app)/admin/page.tsx', 'utf8');
fs.writeFileSync('app/(app)/admin/page.tsx', page, 'utf8');

let c = fs.readFileSync('components/admin/AdminDashboard.tsx', 'utf8');

// Add VENUES import
c = c.replace(
  "import type { Court, Profile } from '@/types/database'",
  "import type { Court, Profile } from '@/types/database'\nimport { VENUES } from '@/lib/venues'"
);

// Add 'board' to the tab type
c = c.replace(
  "const [tab, setTab] = useState<'bookings' | 'members' | 'courts'>('bookings')",
  "const [tab, setTab] = useState<'board' | 'bookings' | 'members' | 'courts'>('board')\n  const [selectedVenueSlug, setSelectedVenueSlug] = useState<string>('')\n  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week')\n  const [boardDate, setBoardDate] = useState(new Date().toISOString().slice(0, 10))"
);

// Add 'board' to the tabs array
c = c.replace(
  "{(['bookings', 'members', 'courts'] as const).map(t => (",
  "{(['board', 'bookings', 'members', 'courts'] as const).map(t => ("
);

// Insert the Board tab content right before the Bookings tab comment
c = c.replace(
  "        {/* Bookings tab */}",
  `        {/* Board tab */}
        {tab === 'board' && (
          <BoardView bookings={bookings} courts={courts} selectedVenueSlug={selectedVenueSlug} setSelectedVenueSlug={setSelectedVenueSlug} viewMode={viewMode} setViewMode={setViewMode} boardDate={boardDate} setBoardDate={setBoardDate} />
        )}

        {/* Bookings tab */}`
);

// Add the BoardView component at the end of the file
c += `

function BoardView({
  bookings, courts, selectedVenueSlug, setSelectedVenueSlug, viewMode, setViewMode, boardDate, setBoardDate,
}: {
  bookings: any[]
  courts: Court[]
  selectedVenueSlug: string
  setSelectedVenueSlug: (s: string) => void
  viewMode: 'day' | 'week' | 'month'
  setViewMode: (m: 'day' | 'week' | 'month') => void
  boardDate: string
  setBoardDate: (d: string) => void
}) {
  const venuesWithCourts = VENUES.filter(v => courts.some((c: any) => c.venue_slug === v.slug))
  const activeVenue = selectedVenueSlug || venuesWithCourts[0]?.slug || ''
  const venueCourts = courts.filter((c: any) => c.venue_slug === activeVenue)

  const getDateRange = () => {
    const base = new Date(boardDate + 'T00:00:00')
    if (viewMode === 'day') return [boardDate]
    if (viewMode === 'week') {
      const day = base.getDay()
      const monday = new Date(base)
      monday.setDate(base.getDate() - ((day + 6) % 7))
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday)
        d.setDate(monday.getDate() + i)
        return d.toISOString().slice(0, 10)
      })
    }
    // month
    const year = base.getFullYear()
    const month = base.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    return Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(year, month, i + 1)
      return d.toISOString().slice(0, 10)
    })
  }

  const dateRange = getDateRange()
  const TIME_ROWS = Array.from({ length: 16 }, (_, i) => {
    const h = 7 + i
    return String(h).padStart(2, '0') + ':00'
  })

  const dayLabel = (d: string) => {
    const date = new Date(d + 'T00:00:00')
    return date.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  const shiftDate = (dir: 1 | -1) => {
    const base = new Date(boardDate + 'T00:00:00')
    const days = viewMode === 'day' ? 1 : viewMode === 'week' ? 7 : 30
    base.setDate(base.getDate() + dir * days)
    setBoardDate(base.toISOString().slice(0, 10))
  }

  const findBooking = (courtId: string, date: string, time: string) => {
    return bookings.find((b: any) =>
      b.courts && b.court_id === courtId && b.date === date && b.status !== 'cancelled' &&
      b.start_time.slice(0, 5) <= time && b.end_time.slice(0, 5) > time
    )
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          className="input text-sm w-auto"
          value={activeVenue}
          onChange={e => setSelectedVenueSlug(e.target.value)}
        >
          {venuesWithCourts.map(v => (
            <option key={v.slug} value={v.slug}>{v.name} — {v.region}</option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <button onClick={() => shiftDate(-1)} className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>←</button>
          <span className="text-sm font-medium px-2" style={{ color: 'var(--text-primary)' }}>
            {viewMode === 'month'
              ? new Date(boardDate + 'T00:00:00').toLocaleDateString('en-NZ', { month: 'long', year: 'numeric' })
              : dayLabel(boardDate)}
          </span>
          <button onClick={() => shiftDate(1)} className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>→</button>
        </div>

        <div className="flex gap-1 rounded-lg p-1" style={{ background: 'var(--bg-raised)' }}>
          {(['day', 'week', 'month'] as const).map(m => (
            <button key={m} onClick={() => setViewMode(m)}
              className="px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all"
              style={{
                background: viewMode === m ? 'var(--brand-primary)' : 'transparent',
                color: viewMode === m ? 'var(--brand-primary-on)' : 'var(--text-muted)',
              }}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {venueCourts.length === 0 ? (
        <div className="rounded-xl text-center py-12 text-sm" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          No courts found for this venue.
        </div>
      ) : viewMode === 'month' ? (
        // Month view — simple list grouped by day
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          {dateRange.map(d => {
            const dayBookings = bookings.filter((b: any) => b.date === d && venueCourts.some((c: any) => c.id === b.court_id) && b.status !== 'cancelled')
            if (dayBookings.length === 0) return null
            return (
              <div key={d} className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>{dayLabel(d)}</div>
                <div className="flex flex-wrap gap-2">
                  {dayBookings.map((b: any) => (
                    <span key={b.id} className="text-xs px-2 py-1 rounded-lg" style={{ background: 'var(--brand-primary-muted)', color: 'var(--brand-primary)' }}>
                      {b.start_time.slice(0,5)} · {b.courts?.name} · {b.profiles?.full_name ?? 'Unknown'}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        // Day / Week grid view
        <div className="rounded-xl overflow-x-auto" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 px-3 py-2 text-left font-medium whitespace-nowrap" style={{ background: 'var(--bg-surface)', color: 'var(--text-subtle)', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>Court</th>
                {dateRange.map(d => (
                  TIME_ROWS.map((t, i) => (
                    viewMode === 'day' ? (
                      <th key={d + t} className="px-2 py-2 font-medium whitespace-nowrap text-center" style={{ color: 'var(--text-subtle)', borderBottom: '1px solid var(--border)', minWidth: 60 }}>
                        {t}
                      </th>
                    ) : i === 0 ? (
                      <th key={d} colSpan={1} className="px-2 py-2 font-medium whitespace-nowrap text-center" style={{ color: 'var(--text-subtle)', borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)' }}>
                        {dayLabel(d)}
                      </th>
                    ) : null
                  ))
                ))}
              </tr>
            </thead>
            <tbody>
              {venueCourts.map((court: any) => (
                <tr key={court.id}>
                  <td className="sticky left-0 px-3 py-2 font-medium whitespace-nowrap" style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
                    {court.name}
                  </td>
                  {viewMode === 'day' ? (
                    TIME_ROWS.map(t => {
                      const b = findBooking(court.id, boardDate, t)
                      return (
                        <td key={t} className="px-1 py-1 text-center" style={{ borderBottom: '1px solid var(--border)', minWidth: 60 }}>
                          {b ? (
                            <div className="rounded-md px-1 py-1 text-[10px] font-medium truncate" style={{ background: 'var(--brand-primary-muted)', color: 'var(--brand-primary)' }} title={b.profiles?.full_name}>
                              {b.profiles?.full_name?.split(' ')[0] ?? '—'}
                            </div>
                          ) : (
                            <div className="h-5" />
                          )}
                        </td>
                      )
                    })
                  ) : (
                    dateRange.map(d => {
                      const dayBookings = bookings.filter((b: any) => b.date === d && b.court_id === court.id && b.status !== 'cancelled')
                      return (
                        <td key={d} className="px-1 py-1 text-center align-top" style={{ borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', minWidth: 90 }}>
                          {dayBookings.length === 0 ? (
                            <div className="h-5" />
                          ) : (
                            <div className="space-y-1">
                              {dayBookings.map((b: any) => (
                                <div key={b.id} className="rounded-md px-1 py-1 text-[10px] font-medium truncate" style={{ background: 'var(--brand-primary-muted)', color: 'var(--brand-primary)' }} title={b.profiles?.full_name}>
                                  {b.start_time.slice(0,5)} {b.profiles?.full_name?.split(' ')[0] ?? '—'}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      )
                    })
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
`;

fs.writeFileSync('components/admin/AdminDashboard.tsx', c, 'utf8');
console.log('Done');
