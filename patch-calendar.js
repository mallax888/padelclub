const fs = require('fs');
let c = fs.readFileSync('components/admin/AdminDashboard.tsx', 'utf8');

const oldMonth = `        ) : viewMode === 'month' ? (
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
          </div>`;

const newMonth = `        ) : viewMode === 'month' ? (
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
                const cells = []
                for (let i = 0; i < firstDay; i++) {
                  const d = new Date(year, month, -firstDay + i + 1)
                  cells.push({ date: d.toISOString().slice(0, 10), otherMonth: true })
                }
                for (let i = 1; i <= daysInMonth; i++) {
                  cells.push({ date: new Date(year, month, i).toISOString().slice(0, 10), otherMonth: false })
                }
                const remaining = 7 - (cells.length % 7)
                if (remaining < 7) {
                  for (let i = 1; i <= remaining; i++) {
                    cells.push({ date: new Date(year, month + 1, i).toISOString().slice(0, 10), otherMonth: true })
                  }
                }
                const courtColors = ['var(--brand-primary)', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4', '#10B981']
                const courtColorMap: Record<string, string> = {}
                venueCourts.forEach((court: any, i: number) => { courtColorMap[court.id] = courtColors[i % courtColors.length] })
                return cells.map(({ date, otherMonth }, idx) => {
                  const dayBookings = bookings.filter((b: any) => b.date === date && venueCourts.some((c: any) => c.id === b.court_id) && b.status !== 'cancelled')
                  const isToday = date === today
                  const dayNum = parseInt(date.slice(8, 10))
                  const showBookings = dayBookings.slice(0, 2)
                  const extra = dayBookings.length - 2
                  return (
                    <div key={idx} style={{
                      borderRight: (idx + 1) % 7 === 0 ? 'none' : '1px solid var(--border)',
                      borderBottom: '1px solid var(--border)',
                      minHeight: 76,
                      padding: 4,
                      background: isToday ? 'rgba(0,255,135,0.06)' : 'var(--bg-surface)',
                      opacity: otherMonth ? 0.35 : 1,
                    }}>
                      <div style={{ fontSize: 11, fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--brand-primary)' : 'var(--text-subtle)', marginBottom: 3 }}>{dayNum}</div>
                      {showBookings.map((b: any) => {
                        const color = courtColorMap[b.court_id] ?? 'var(--brand-primary)'
                        return (
                          <div key={b.id} style={{ fontSize: 10, padding: '1px 4px', borderRadius: 3, marginBottom: 2, background: color + '22', color: color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {b.start_time.slice(0,5)} · {b.profiles?.full_name?.split(' ')[0] ?? '?'}
                          </div>
                        )
                      })}
                      {extra > 0 && <div style={{ fontSize: 10, color: 'var(--text-subtle)', padding: '0 4px' }}>+{extra} more</div>}
                    </div>
                  )
                })
              })()}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
              {venueCourts.map((court: any, i: number) => {
                const colors = ['var(--brand-primary)', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4', '#10B981']
                const color = colors[i % colors.length]
                return (
                  <div key={court.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-subtle)' }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
                    {court.name}
                  </div>
                )
              })}
            </div>
          </div>`;

c = c.replace(oldMonth, newMonth);
fs.writeFileSync('components/admin/AdminDashboard.tsx', c, 'utf8');
console.log('Done - replaced:', !c.includes('simple list grouped by day'));
