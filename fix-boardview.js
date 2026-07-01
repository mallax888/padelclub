const fs = require('fs');
let c = fs.readFileSync('components/admin/AdminDashboard.tsx', 'utf8');

const boardStart = c.indexOf('\nfunction BoardView(');
if (boardStart === -1) { console.log('BoardView not found'); process.exit(1); }

const before = c.slice(0, boardStart);

const newBoardView = `
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

  const getWeekDates = () => {
    const base = new Date(boardDate + 'T00:00:00')
    const day = base.getDay()
    const monday = new Date(base)
    monday.setDate(base.getDate() - ((day + 6) % 7))
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      return d.toISOString().slice(0, 10)
    })
  }

  const TIME_ROWS = Array.from({ length: 16 }, (_, i) => String(7 + i).padStart(2, '0') + ':00')
  const weekDates = getWeekDates()
  const courtColors = ['var(--brand-primary)', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4', '#10B981']
  const colorMap: Record<string, string> = {}
  venueCourts.forEach((court: any, i: number) => { colorMap[court.id] = courtColors[i % courtColors.length] })

  const title = viewMode === 'month'
    ? new Date(boardDate + 'T00:00:00').toLocaleDateString('en-NZ', { month: 'long', year: 'numeric' })
    : viewMode === 'week'
    ? dayLabel(weekDates[0]) + ' – ' + dayLabel(weekDates[6])
    : dayLabel(boardDate)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select className="input text-sm w-auto" value={activeVenue} onChange={e => setSelectedVenueSlug(e.target.value)}>
          {venuesWithCourts.map(v => (
            <option key={v.slug} value={v.slug}>{v.name} — {v.region}</option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <button onClick={() => shiftDate(-1)} className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>←</button>
          <span className="text-sm font-medium px-2" style={{ color: 'var(--text-primary)' }}>{title}</span>
          <button onClick={() => shiftDate(1)} className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>→</button>
        </div>
        <div className="flex gap-1 rounded-lg p-1" style={{ background: 'var(--bg-raised)' }}>
          {(['day', 'week', 'month'] as const).map(m => (
            <button key={m} onClick={() => setViewMode(m)}
              className="px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all"
              style={{ background: viewMode === m ? 'var(--brand-primary)' : 'transparent', color: viewMode === m ? 'var(--brand-primary-on)' : 'var(--text-muted)' }}>
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
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
              <div key={d} style={{ padding: '6px 4px', textAlign: 'center', fontSize: 11, color: 'var(--text-subtle)', fontWeight: 500, background: 'var(--bg-raised)', borderBottom: '1px solid var(--border)' }}>{d}</div>
            ))}
            {(() => {
              const base = new Date(boardDate + 'T00:00:00')
              const year = base.getFullYear()
              const month = base.getMonth()
              const firstDay = new Date(year, month, 1).getDay()
              const daysInMonth = new Date(year, month + 1, 0).getDate()
              const today = new Date().toISOString().slice(0, 10)
              const cells: { date: string; otherMonth: boolean }[] = []
              for (let i = 0; i < firstDay; i++) {
                const d = new Date(year, month, -firstDay + i + 1)
                cells.push({ date: d.toISOString().slice(0, 10), otherMonth: true })
              }
              for (let i = 1; i <= daysInMonth; i++) {
                cells.push({ date: new Date(year, month, i).toISOString().slice(0, 10), otherMonth: false })
              }
              const remaining = 7 - (cells.length % 7)
              if (remaining < 7) for (let i = 1; i <= remaining; i++) cells.push({ date: new Date(year, month + 1, i).toISOString().slice(0, 10), otherMonth: true })
              return cells.map(({ date, otherMonth }, idx) => {
                const dayBookings = bookings.filter((b: any) => b.date === date && venueCourts.some((c: any) => c.id === b.court_id) && b.status !== 'cancelled')
                const isToday = date === today
                const dayNum = parseInt(date.slice(8, 10))
                const show = dayBookings.slice(0, 2)
                const extra = dayBookings.length - 2
                return (
                  <div key={idx} style={{ borderRight: (idx + 1) % 7 === 0 ? 'none' : '1px solid var(--border)', borderBottom: '1px solid var(--border)', minHeight: 76, padding: 4, background: isToday ? 'rgba(0,255,135,0.06)' : 'var(--bg-surface)', opacity: otherMonth ? 0.35 : 1 }}>
                    <div style={{ fontSize: 11, fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--brand-primary)' : 'var(--text-subtle)', marginBottom: 3 }}>{dayNum}</div>
                    {show.map((b: any) => {
                      const color = colorMap[b.court_id] ?? 'var(--brand-primary)'
                      return <div key={b.id} style={{ fontSize: 10, padding: '1px 4px', borderRadius: 3, marginBottom: 2, background: color + '22', color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.start_time.slice(0,5)} · {b.profiles?.full_name?.split(' ')[0] ?? '?'}</div>
                    })}
                    {extra > 0 && <div style={{ fontSize: 10, color: 'var(--text-subtle)', padding: '0 4px' }}>+{extra} more</div>}
                  </div>
                )
              })
            })()}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
            {venueCourts.map((court: any, i: number) => (
              <div key={court.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-subtle)' }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: courtColors[i % courtColors.length] }} />
                {court.name}
              </div>
            ))}
          </div>
        </div>
      ) : viewMode === 'week' ? (
        <div className="rounded-xl overflow-x-auto" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 px-3 py-2 text-left font-medium whitespace-nowrap" style={{ background: 'var(--bg-surface)', color: 'var(--text-subtle)', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>Court</th>
                {weekDates.map(d => (
                  <th key={d} className="px-2 py-2 font-medium whitespace-nowrap text-center" style={{ color: 'var(--text-subtle)', borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', minWidth: 90 }}>
                    {dayLabel(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {venueCourts.map((court: any) => (
                <tr key={court.id}>
                  <td className="sticky left-0 px-3 py-2 font-medium whitespace-nowrap" style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
                    {court.name}
                  </td>
                  {weekDates.map(d => {
                    const dayBookings = bookings.filter((b: any) => b.date === d && b.court_id === court.id && b.status !== 'cancelled')
                    return (
                      <td key={d} className="px-1 py-1 text-center align-top" style={{ borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', minWidth: 90 }}>
                        {dayBookings.length === 0 ? <div className="h-5" /> : (
                          <div className="space-y-1">
                            {dayBookings.map((b: any) => (
                              <div key={b.id} className="rounded-md px-1 py-1 text-[10px] font-medium truncate" style={{ background: 'var(--brand-primary-muted)', color: 'var(--brand-primary)' }}>
                                {b.start_time.slice(0,5)} {b.profiles?.full_name?.split(' ')[0] ?? '—'}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl overflow-x-auto" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 px-3 py-2 text-left font-medium" style={{ background: 'var(--bg-surface)', color: 'var(--text-subtle)', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>Court</th>
                {TIME_ROWS.map(t => (
                  <th key={t} className="px-2 py-2 font-medium whitespace-nowrap text-center" style={{ color: 'var(--text-subtle)', borderBottom: '1px solid var(--border)', minWidth: 60 }}>{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {venueCourts.map((court: any) => (
                <tr key={court.id}>
                  <td className="sticky left-0 px-3 py-2 font-medium whitespace-nowrap" style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
                    {court.name}
                  </td>
                  {TIME_ROWS.map(t => {
                    const b = bookings.find((b: any) => b.court_id === court.id && b.date === boardDate && b.status !== 'cancelled' && b.start_time.slice(0,5) <= t && b.end_time.slice(0,5) > t)
                    return (
                      <td key={t} className="px-1 py-1 text-center" style={{ borderBottom: '1px solid var(--border)', minWidth: 60 }}>
                        {b ? (
                          <div className="rounded-md px-1 py-1 text-[10px] font-medium truncate" style={{ background: 'var(--brand-primary-muted)', color: 'var(--brand-primary)' }}>
                            {b.profiles?.full_name?.split(' ')[0] ?? '—'}
                          </div>
                        ) : <div className="h-5" />}
                      </td>
                    )
                  })}
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

fs.writeFileSync('components/admin/AdminDashboard.tsx', before + newBoardView, 'utf8');
console.log('Done - lines:', (before + newBoardView).split('\n').length);
