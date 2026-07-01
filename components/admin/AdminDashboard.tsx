'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { cn, formatNzd, formatDate, generateTimeSlots, getNextNDates } from '@/lib/utils'
import type { Court, Profile } from '@/types/database'
import { VENUES } from '@/lib/venues'

const TIME_SLOTS = generateTimeSlots(7, 22, 60)

type AdminBooking = {
  id: string
  date: string
  start_time: string
  end_time: string
  status: string
  price_nzd: number
  payment_method: string
  notes: string | null
  profiles: { full_name: string | null; membership_tier: string } | null
  courts: { name: string; type: string } | null
}

export default function AdminDashboard({
  bookings,
  members,
  courts,
}: {
  bookings: AdminBooking[]
  members: Profile[]
  courts: Court[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState<'board' | 'bookings' | 'members' | 'courts'>('board')
  const [selectedVenueSlug, setSelectedVenueSlug] = useState<string>('')
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week')
  const [boardDate, setBoardDate] = useState(new Date().toISOString().slice(0, 10))
  const [showBlock, setShowBlock] = useState(false)
  const [blockForm, setBlockForm] = useState({
    courtId: courts[0]?.id ?? '',
    date: getNextNDates(1)[0],
    time: '09:00',
    notes: '',
  })

  const today = new Date().toISOString().slice(0, 10)
  const todayBookings = bookings.filter(b => b.date === today && b.status !== 'cancelled')
  const revenue = bookings.filter(b => b.status === 'confirmed').reduce((s, b) => s + b.price_nzd, 0)
  const memberCount = members.filter(m => (m as any).membership_tier !== 'casual').length

  const cancelBooking = async (id: string) => {
    if (!confirm('Cancel this booking?')) return
    const { createClient } = await import('@/lib/supabase-browser')
    const supabase = createClient() as any
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id)
    toast.success('Booking cancelled')
    router.refresh()
  }

  const blockCourt = async () => {
    const court = courts.find(c => c.id === blockForm.courtId)
    if (!court) return
    const { createClient } = await import('@/lib/supabase-browser')
    const supabase = createClient() as any
    const user = await supabase.auth.getUser()
    const endHour = String(parseInt(blockForm.time.split(':')[0]) + 1).padStart(2, '0')
    const { error } = await supabase.from('bookings').insert({
      user_id: user.data.user?.id,
      court_id: blockForm.courtId,
      date: blockForm.date,
      start_time: blockForm.time + ':00',
      end_time: endHour + ':00:00',
      duration_minutes: 60,
      status: 'blocked',
      price_nzd: 0,
      payment_method: 'staff_block',
      notes: blockForm.notes || 'Blocked by staff',
    })
    if (error?.code === '23505') {
      toast.error('That slot is already taken.')
    } else if (error) {
      toast.error(error.message)
    } else {
      toast.success('Court blocked')
      setShowBlock(false)
      router.refresh()
    }
  }

  return (
    <div>
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Today's bookings", value: todayBookings.length, color: 'var(--brand-primary)' },
          { label: 'Total bookings',   value: bookings.filter(b => b.status === 'confirmed').length, color: 'var(--text-primary)' },
          { label: 'Paying members',   value: memberCount, color: 'var(--brand-accent)' },
          { label: 'Revenue',          value: formatNzd(revenue), color: 'var(--brand-primary)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl p-4"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="text-xs mb-1" style={{ color: 'var(--text-subtle)' }}>{label}</div>
            <div className="text-xl font-semibold" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4" style={{ borderBottom: '1px solid var(--border)' }}>
        {(['board', 'bookings', 'members', 'courts'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-2 text-sm capitalize transition-colors"
            style={{
              borderBottom: `2px solid ${tab === t ? 'var(--brand-primary)' : 'transparent'}`,
              color: tab === t ? 'var(--brand-primary)' : 'var(--text-muted)',
              fontWeight: tab === t ? 500 : 400,
              marginBottom: -1,
            }}
          >
            {t}
          </button>
        ))}
        <div className="flex-1" />
        {tab === 'bookings' && (
          <button className="btn btn-primary btn-sm mb-1" onClick={() => setShowBlock(true)}>
            🔒 Block a court
          </button>
        )}
      </div>

{/* Board tab */}
      {tab === 'board' && (
        <BoardView bookings={bookings} courts={courts} selectedVenueSlug={selectedVenueSlug} setSelectedVenueSlug={setSelectedVenueSlug} viewMode={viewMode} setViewMode={setViewMode} boardDate={boardDate} setBoardDate={setBoardDate} />
      )}

      {/* Bookings tab */}
      {tab === 'bookings' && (
        <div className="rounded-xl overflow-x-auto"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Member','Court','Date','Time','Amount','Status',''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium whitespace-nowrap"
                    style={{ color: 'var(--text-subtle)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bookings.map(b => (
                <tr key={b.id} className="last:border-0 transition-colors"
                  style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-raised)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                    {b.profiles?.full_name ?? '—'}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>{b.courts?.name}</td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{formatDate(b.date)}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>{b.start_time.slice(0,5)}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                    {b.price_nzd > 0 ? formatNzd(b.price_nzd) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('badge', `status-${b.status}`)}>{b.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    {b.status !== 'cancelled' && b.status !== 'blocked' && (
                      <button className="btn btn-danger btn-sm" onClick={() => cancelBooking(b.id)}>
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Members tab */}
      {tab === 'members' && (
        <div className="rounded-xl overflow-x-auto"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['#','Name','Membership','Credits','Role','Joined'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium"
                    style={{ color: 'var(--text-subtle)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map(m => (
                <tr key={m.id} className="last:border-0 transition-colors"
                  style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-raised)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-subtle)' }}>
                    #{(m as any).member_number ?? '—'}
                  </td>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                    {(m as any).nickname ?? m.full_name ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="badge badge-member capitalize">{m.membership_tier}</span>
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--brand-primary)' }}>{m.credits}</td>
                  <td className="px-4 py-3 capitalize" style={{ color: 'var(--text-muted)' }}>{m.role}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-subtle)' }}>
                    {(m as any).created_at?.slice(0,10)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Courts tab */}
      {tab === 'courts' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {courts.map(c => (
            <div key={c.id} className="rounded-xl p-5"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{c.name}</div>
                  <div className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {c.is_indoor ? '🏢' : '☀️'} {c.type} · {(c as any).sport}
                  </div>
                </div>
                <span className={cn('badge', c.is_active ? 'badge-member' : 'status-cancelled')}>
                  {c.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                {formatNzd(c.price_per_hour)}/hr · {(c as any).surface}
              </div>
              {(c as any).description && (
                <div className="text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>{(c as any).description}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Block court modal */}
      {showBlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={e => e.target === e.currentTarget && setShowBlock(false)}>
          <div className="rounded-xl p-6 w-full max-w-sm"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="font-semibold text-base mb-4" style={{ color: 'var(--text-primary)' }}>
              Block court time
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Court</label>
                <select className="input" value={blockForm.courtId}
                  onChange={e => setBlockForm(f => ({...f, courtId: e.target.value}))}>
                  {courts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Date</label>
                  <input type="date" className="input" value={blockForm.date}
                    onChange={e => setBlockForm(f => ({...f, date: e.target.value}))} />
                </div>
                <div>
                  <label className="label">Time</label>
                  <select className="input" value={blockForm.time}
                    onChange={e => setBlockForm(f => ({...f, time: e.target.value}))}>
                    {TIME_SLOTS.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Reason (optional)</label>
                <input type="text" className="input" placeholder="Maintenance, private event…"
                  value={blockForm.notes}
                  onChange={e => setBlockForm(f => ({...f, notes: e.target.value}))} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button className="btn flex-1 justify-center" onClick={() => setShowBlock(false)}>Cancel</button>
              <button className="btn btn-primary flex-1 justify-center" onClick={blockCourt}>Block court</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


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
