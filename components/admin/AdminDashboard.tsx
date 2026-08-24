'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { cn, formatNzd, formatDate, generateTimeSlots, getNextNDates, localDateStr } from '@/lib/utils'
import type { Court, Profile } from '@/types/database'
import { VENUES } from '@/lib/venues'
import XeroSettingsPanel from '@/components/admin/XeroSettingsPanel'
import ClubAnalytics from '@/components/admin/ClubAnalytics'
import type { ClubAnalytics as ClubAnalyticsData, CourtPerformanceBooking } from '@/lib/analytics'

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
  managedVenueSlug,
  analytics,
  courtPerfBookings,
}: {
  bookings: AdminBooking[]
  members: Profile[]
  courts: Court[]
  managedVenueSlug?: string | null
  analytics: ClubAnalyticsData
  courtPerfBookings: CourtPerformanceBooking[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState<'board' | 'analytics' | 'bookings' | 'members' | 'courts' | 'xero'>('board')
  const [selectedVenueSlug, setSelectedVenueSlug] = useState<string>('')
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week')
  const [boardDate, setBoardDate] = useState(localDateStr())
  const [showBlock, setShowBlock] = useState(false)
  const [showPastBookings, setShowPastBookings] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')
  const [memberTierFilter, setMemberTierFilter] = useState<'all' | string>('all')
  const [blockForm, setBlockForm] = useState({
    courtId: courts[0]?.id ?? '',
    date: getNextNDates(1)[0],
    time: '09:00',
    notes: '',
  })
  const [editingCourt, setEditingCourt] = useState<Court | 'new' | null>(null)
  const [courtForm, setCourtForm] = useState({
    name: '',
    type: '',
    price_per_hour: '',
    price_per_hour_peak: '',
    is_active: true,
    is_indoor: true,
    description: '',
  })
  const [savingCourt, setSavingCourt] = useState(false)

  const today = localDateStr()
  const todayBookings = bookings.filter(b => b.date === today && b.status !== 'cancelled')
  const revenue = bookings.filter(b => b.status === 'confirmed').reduce((s, b) => s + b.price_nzd, 0)
  const memberCount = members.filter(m => (m as any).membership_tier !== 'casual').length

  const venuesWithCourts = VENUES.filter(v => v.isLive && courts.some((c: any) => c.venue_slug === v.slug))
  // Courts tab needs to offer every *live* venue, including one with no
  // courts yet -- that's exactly the "onboard a new club's first courts"
  // case this tab exists to support. lib/venues.ts also carries a long list
  // of not-yet-signed "coming soon" venues used for marketing/expansion
  // planning (isLive: false) -- those aren't real clubs in this deployment
  // and would just clutter an admin's venue picker with places they don't
  // run. Board/Bookings only make sense for a venue that already has courts
  // to show, so they stay scoped to that subset of the live ones.
  const liveVenues = VENUES.filter(v => v.isLive)
  const selectableVenues = managedVenueSlug ? liveVenues.filter(v => v.slug === managedVenueSlug) : liveVenues
  const courtTabVenues = selectableVenues
  const activeVenue = selectedVenueSlug || managedVenueSlug || venuesWithCourts[0]?.slug || selectableVenues[0]?.slug || ''
  const venueCourts = courts.filter((c: any) => c.venue_slug === activeVenue)
  const venueCourtIds = new Set(venueCourts.map(c => c.id))

  const bookingsForVenue = bookings.filter((b: any) => venueCourtIds.has(b.court_id))
  const visibleBookings = bookingsForVenue
    .filter(b => showPastBookings || b.date >= today)
    .sort((a, b) => (a.date === b.date ? a.start_time.localeCompare(b.start_time) : a.date.localeCompare(b.date)))

  // Every venue in lib/venues.ts names its courts generically ("Court 1",
  // "Court 2"...), so leaving this unscoped mixes different venues' courts
  // together under the same display name in the leaderboard -- same
  // venueCourtIds scoping as bookingsForVenue above.
  const courtPerfForVenue = courtPerfBookings.filter(b => venueCourtIds.has(b.court_id))

  const memberTiers = Array.from(new Set(members.map(m => m.membership_tier))).sort()
  const memberSearchTerm = memberSearch.trim().toLowerCase()
  const visibleMembers = members.filter(m => {
    if (memberTierFilter !== 'all' && m.membership_tier !== memberTierFilter) return false
    if (!memberSearchTerm) return true
    const haystack = [
      (m as any).nickname, m.full_name, (m as any).member_number != null ? `#${(m as any).member_number}` : null,
    ].filter(Boolean).join(' ').toLowerCase()
    return haystack.includes(memberSearchTerm)
  })

  const cancelBooking = async (id: string) => {
    if (!confirm('Cancel this booking?')) return
    const { createClient } = await import('@/lib/supabase-browser')
    const supabase = createClient()
    const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id)
    if (error) {
      toast.error('Could not cancel booking')
      return
    }
    toast.success('Booking cancelled')
    router.refresh()
  }

  const blockCourt = async () => {
    const court = courts.find(c => c.id === blockForm.courtId)
    if (!court) return
    const { createClient } = await import('@/lib/supabase-browser')
    const supabase = createClient()
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

  const openAddCourt = () => {
    setCourtForm({ name: '', type: '', price_per_hour: '', price_per_hour_peak: '', is_active: true, is_indoor: true, description: '' })
    setEditingCourt('new')
  }

  const openEditCourt = (court: Court) => {
    setCourtForm({
      name: court.name,
      type: court.type,
      price_per_hour: String(court.price_per_hour),
      price_per_hour_peak: (court as any).price_per_hour_peak != null ? String((court as any).price_per_hour_peak) : '',
      is_active: court.is_active,
      is_indoor: court.is_indoor,
      description: (court as any).description ?? '',
    })
    setEditingCourt(court)
  }

  const saveCourt = async () => {
    if (!courtForm.name.trim() || !courtForm.type.trim() || !courtForm.price_per_hour) {
      toast.error('Name, type and price are required')
      return
    }
    setSavingCourt(true)
    const { createClient } = await import('@/lib/supabase-browser')
    const supabase = createClient()
    const payload = {
      name: courtForm.name.trim(),
      type: courtForm.type.trim(),
      price_per_hour: parseFloat(courtForm.price_per_hour),
      price_per_hour_peak: courtForm.price_per_hour_peak ? parseFloat(courtForm.price_per_hour_peak) : null,
      is_active: courtForm.is_active,
      is_indoor: courtForm.is_indoor,
      description: courtForm.description.trim() || null,
    }
    const { error } = editingCourt === 'new'
      ? await supabase.from('courts').insert({ ...payload, venue_slug: activeVenue })
      : await supabase.from('courts').update(payload).eq('id', (editingCourt as Court).id)
    setSavingCourt(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success(editingCourt === 'new' ? 'Court added' : 'Court updated')
    setEditingCourt(null)
    router.refresh()
  }

  return (
    <div>
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Today's bookings", value: todayBookings.length, color: 'var(--brand-primary-text)' },
          { label: 'Total bookings',   value: bookings.filter(b => b.status === 'confirmed').length, color: 'var(--text-primary)' },
          { label: 'Paying members',   value: memberCount, color: 'var(--brand-accent)' },
          { label: 'Revenue',          value: formatNzd(revenue), color: 'var(--brand-primary-text)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-2xl p-4"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
            <div className="text-xs mb-1" style={{ color: 'var(--text-subtle)' }}>{label}</div>
            <div className="text-xl font-semibold" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4" style={{ borderBottom: '1px solid var(--border)' }}>
        {(['board', 'analytics', 'bookings', 'members', 'courts', 'xero'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-2 text-sm capitalize transition-colors"
            style={{
              borderBottom: `2px solid ${tab === t ? 'var(--brand-primary)' : 'transparent'}`,
              color: tab === t ? 'var(--brand-primary-text)' : 'var(--text-muted)',
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

      {/* Venue selector - shared across Board / Bookings / Courts */}
      {((tab === 'board' || tab === 'bookings') && venuesWithCourts.length > 0) || (tab === 'courts' && courtTabVenues.length > 0) ? (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          {managedVenueSlug ? (
            <div className="text-sm font-medium px-1" style={{ color: 'var(--text-primary)' }}>
              {(venuesWithCourts[0] ?? selectableVenues[0])?.name ?? managedVenueSlug} — {(venuesWithCourts[0] ?? selectableVenues[0])?.region ?? ''}
            </div>
          ) : (
            <select className="input text-sm w-auto" value={activeVenue} onChange={e => setSelectedVenueSlug(e.target.value)}>
              {(tab === 'courts' ? courtTabVenues : venuesWithCourts).map(v => (
                <option key={v.slug} value={v.slug}>{v.name} — {v.region}</option>
              ))}
            </select>
          )}
          {tab === 'bookings' && (
            <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--text-muted)' }}>
              <input type="checkbox" checked={showPastBookings} onChange={e => setShowPastBookings(e.target.checked)} />
              Show past bookings
            </label>
          )}
          {tab === 'courts' && (
            <button className="btn btn-primary btn-sm" onClick={openAddCourt}>+ Add court</button>
          )}
        </div>
      ) : null}

{/* Board tab */}
      {tab === 'board' && (
        <BoardView bookings={bookings} venueCourts={venueCourts} boardDate={boardDate} setBoardDate={setBoardDate} viewMode={viewMode} setViewMode={setViewMode} />
      )}

      {tab === 'analytics' && <ClubAnalytics data={analytics} courtPerfBookings={courtPerfForVenue} />}

      {/* Bookings tab */}
      {tab === 'bookings' && (
        <div className="rounded-2xl overflow-x-auto"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
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
              {visibleBookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    No {showPastBookings ? '' : 'upcoming '}bookings for this venue.
                  </td>
                </tr>
              ) : visibleBookings.map(b => (
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
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <input type="text" className="input text-sm w-auto flex-1 min-w-[180px]" placeholder="Search by name or member #…"
              value={memberSearch} onChange={e => setMemberSearch(e.target.value)} />
            <select className="input text-sm w-auto" value={memberTierFilter} onChange={e => setMemberTierFilter(e.target.value)}>
              <option value="all">All memberships</option>
              {memberTiers.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
            </select>
            <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>
              {visibleMembers.length} of {members.length}
            </span>
          </div>
          <div className="rounded-2xl overflow-x-auto"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
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
                {visibleMembers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                      No members match your search.
                    </td>
                  </tr>
                ) : visibleMembers.map(m => (
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
                    <td className="px-4 py-3" style={{ color: 'var(--brand-primary-text)' }}>{m.credits}</td>
                    <td className="px-4 py-3 capitalize" style={{ color: 'var(--text-muted)' }}>{m.role}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-subtle)' }}>
                      {(m as any).created_at?.slice(0,10)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Courts tab */}
      {tab === 'courts' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {venueCourts.length === 0 ? (
            <div className="rounded-xl text-center py-12 text-sm sm:col-span-2" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              No courts yet for this venue.
              <div className="mt-3">
                <button className="btn btn-primary btn-sm" onClick={openAddCourt}>+ Add the first court</button>
              </div>
            </div>
          ) : venueCourts.map(c => (
            <button key={c.id} onClick={() => openEditCourt(c)} className="text-left rounded-2xl p-5 transition-colors"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-raised)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-surface)')}
            >
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
                {formatNzd(c.price_per_hour)}/hr{(c as any).price_per_hour_peak != null ? ` · ${formatNzd((c as any).price_per_hour_peak)}/hr peak` : ''} · {(c as any).surface}
              </div>
              {(c as any).description && (
                <div className="text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>{(c as any).description}</div>
              )}
            </button>
          ))}
        </div>
      )}

      {tab === 'xero' && <XeroSettingsPanel />}

      {/* Block court modal */}
      {showBlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={e => e.target === e.currentTarget && setShowBlock(false)}>
          <div className="rounded-2xl p-6 w-full max-w-sm"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
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

      {/* Add/edit court modal */}
      {editingCourt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={e => e.target === e.currentTarget && setEditingCourt(null)}>
          <div className="rounded-2xl p-6 w-full max-w-sm"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
            <div className="font-semibold text-base mb-4" style={{ color: 'var(--text-primary)' }}>
              {editingCourt === 'new' ? 'Add court' : 'Edit court'}
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Name</label>
                <input type="text" className="input" placeholder="Court 5"
                  value={courtForm.name}
                  onChange={e => setCourtForm(f => ({...f, name: e.target.value}))} />
              </div>
              <div>
                <label className="label">Type</label>
                <input type="text" className="input" placeholder="Glass-backed"
                  value={courtForm.type}
                  onChange={e => setCourtForm(f => ({...f, type: e.target.value}))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Price / hr</label>
                  <input type="number" step="0.01" min="0" className="input" placeholder="70.00"
                    value={courtForm.price_per_hour}
                    onChange={e => setCourtForm(f => ({...f, price_per_hour: e.target.value}))} />
                </div>
                <div>
                  <label className="label">Peak price (optional)</label>
                  <input type="number" step="0.01" min="0" className="input" placeholder="80.00"
                    value={courtForm.price_per_hour_peak}
                    onChange={e => setCourtForm(f => ({...f, price_per_hour_peak: e.target.value}))} />
                </div>
              </div>
              <div>
                <label className="label">Description (optional)</label>
                <input type="text" className="input" placeholder="Premium indoor glass court"
                  value={courtForm.description}
                  onChange={e => setCourtForm(f => ({...f, description: e.target.value}))} />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-primary)' }}>
                  <input type="checkbox" checked={courtForm.is_indoor}
                    onChange={e => setCourtForm(f => ({...f, is_indoor: e.target.checked}))} />
                  Indoor
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-primary)' }}>
                  <input type="checkbox" checked={courtForm.is_active}
                    onChange={e => setCourtForm(f => ({...f, is_active: e.target.checked}))} />
                  Active
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button className="btn flex-1 justify-center" onClick={() => setEditingCourt(null)}>Cancel</button>
              <button className="btn btn-primary flex-1 justify-center" disabled={savingCourt} onClick={saveCourt}>
                {savingCourt ? 'Saving…' : editingCourt === 'new' ? 'Add court' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


function BoardView({
  bookings, venueCourts, viewMode, setViewMode, boardDate, setBoardDate,
}: {
  bookings: any[]
  venueCourts: Court[]
  viewMode: 'day' | 'week' | 'month'
  setViewMode: (m: 'day' | 'week' | 'month') => void
  boardDate: string
  setBoardDate: (d: string) => void
}) {
  const [dayDetail, setDayDetail] = useState<string | null>(null)
  const dayLabel = (d: string) => {
    const date = new Date(d + 'T00:00:00')
    return date.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  const shiftDate = (dir: 1 | -1) => {
    const base = new Date(boardDate + 'T00:00:00')
    const days = viewMode === 'day' ? 1 : viewMode === 'week' ? 7 : 30
    base.setDate(base.getDate() + dir * days)
    setBoardDate(localDateStr(base))
  }

  const getWeekDates = () => {
    const base = new Date(boardDate + 'T00:00:00')
    const day = base.getDay()
    const monday = new Date(base)
    monday.setDate(base.getDate() - ((day + 6) % 7))
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      return localDateStr(d)
    })
  }

  const TIME_ROWS = Array.from({ length: 16 }, (_, i) => String(7 + i).padStart(2, '0') + ':00')
  const weekDates = getWeekDates()
  const today = localDateStr()
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
              <div key={d} style={{ padding: '6px 4px', textAlign: 'center', fontSize: 11, color: 'var(--text-primary)', fontWeight: 700, letterSpacing: 0.3, background: 'var(--bg-raised)', borderBottom: '1px solid var(--border)' }}>{d}</div>
            ))}
            {(() => {
              const base = new Date(boardDate + 'T00:00:00')
              const year = base.getFullYear()
              const month = base.getMonth()
              const firstDay = new Date(year, month, 1).getDay()
              const daysInMonth = new Date(year, month + 1, 0).getDate()
              const cells: { date: string; otherMonth: boolean }[] = []
              for (let i = 0; i < firstDay; i++) {
                const d = new Date(year, month, -firstDay + i + 1)
                cells.push({ date: localDateStr(d), otherMonth: true })
              }
              for (let i = 1; i <= daysInMonth; i++) {
                cells.push({ date: localDateStr(new Date(year, month, i)), otherMonth: false })
              }
              const remaining = 7 - (cells.length % 7)
              if (remaining < 7) for (let i = 1; i <= remaining; i++) cells.push({ date: localDateStr(new Date(year, month + 1, i)), otherMonth: true })
              return cells.map(({ date, otherMonth }, idx) => {
                const dayBookings = bookings.filter((b: any) => b.date === date && venueCourts.some((c: any) => c.id === b.court_id) && b.status !== 'cancelled')
                const isToday = date === today
                const dayNum = parseInt(date.slice(8, 10))
                const show = dayBookings.slice(0, 2)
                const extra = dayBookings.length - 2
                return (
                  <div key={idx} onClick={() => dayBookings.length > 0 && setDayDetail(date)}
                    style={{ borderRight: (idx + 1) % 7 === 0 ? 'none' : '1px solid var(--border)', borderBottom: '1px solid var(--border)', minHeight: 76, padding: 4, background: isToday ? 'rgba(0,255,135,0.14)' : 'var(--bg-surface)', boxShadow: isToday ? 'inset 0 0 0 1px var(--brand-primary)' : 'none', opacity: otherMonth ? 0.4 : 1, cursor: dayBookings.length > 0 ? 'pointer' : 'default' }}>
                    <div style={{ fontSize: 12, fontWeight: isToday ? 800 : 600, color: isToday ? 'var(--brand-primary-text)' : 'var(--text-primary)', marginBottom: 3 }}>{dayNum}</div>
                    {show.map((b: any) => {
                      const color = colorMap[b.court_id] ?? 'var(--brand-primary)'
                      return <div key={b.id} style={{ fontSize: 11, fontWeight: 600, padding: '2px 5px', borderRadius: 3, marginBottom: 2, background: date < today ? 'rgba(170,170,170,0.3)' : color + '38', color: date < today ? 'rgba(255,255,255,0.8)' : color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: date < today ? 'line-through' : 'none' }}>{b.start_time.slice(0,5)} · {b.profiles?.full_name?.split(' ')[0] ?? '?'}</div>
                    })}
                    {extra > 0 && <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--brand-primary-text)', padding: '0 4px' }}>+{extra} more</div>}
                  </div>
                )
              })
            })()}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
            {venueCourts.map((court: any, i: number) => (
              <div key={court.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: courtColors[i % courtColors.length] }} />
                {court.name}
              </div>
            ))}
          </div>
        </div>
      ) : viewMode === 'week' ? (
        <div className="rounded-2xl overflow-x-auto" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 px-3 py-2 text-left font-semibold whitespace-nowrap" style={{ background: 'var(--bg-raised)', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>Court</th>
                {weekDates.map(d => (
                  <th key={d} className="px-2 py-2 font-semibold whitespace-nowrap text-center" style={{ color: d === today ? 'var(--brand-primary-text)' : 'var(--text-primary)', background: d === today ? 'rgba(0,255,135,0.14)' : 'var(--bg-raised)', borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', minWidth: 90 }}>
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
                              <div key={b.id} className="rounded-md px-1 py-1 text-[10px] font-semibold truncate" style={{ background: 'var(--brand-primary-muted)', color: 'var(--brand-primary-text)' }}>
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
        <div className="rounded-2xl overflow-x-auto" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 px-3 py-2 text-left font-semibold" style={{ background: 'var(--bg-raised)', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>Court</th>
                {TIME_ROWS.map(t => (
                  <th key={t} className="px-2 py-2 font-semibold whitespace-nowrap text-center" style={{ color: 'var(--text-primary)', background: 'var(--bg-raised)', borderBottom: '1px solid var(--border)', minWidth: 60 }}>{t}</th>
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
                          <div className="rounded-md px-1 py-1 text-[10px] font-semibold truncate" style={{ background: 'var(--brand-primary-muted)', color: 'var(--brand-primary-text)' }}>
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

      {dayDetail && (() => {
        const detailBookings = bookings
          .filter((b: any) => b.date === dayDetail && venueCourts.some((c: any) => c.id === b.court_id) && b.status !== 'cancelled')
          .sort((a: any, b: any) => a.start_time.localeCompare(b.start_time))
        const detailDate = new Date(dayDetail + 'T00:00:00')
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={e => e.target === e.currentTarget && setDayDetail(null)}>
            <div className="rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
                    {detailDate.toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {detailBookings.length} {detailBookings.length === 1 ? 'booking' : 'bookings'}
                  </div>
                </div>
                <button onClick={() => setDayDetail(null)} className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>✕</button>
              </div>
              <div className="overflow-y-auto px-5 py-3 space-y-2">
                {detailBookings.map((b: any) => {
                  const color = colorMap[b.court_id] ?? 'var(--brand-primary)'
                  return (
                    <div key={b.id} className="rounded-xl p-3" style={{ background: 'var(--bg-raised)' }}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
                          <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                            {b.profiles?.full_name ?? 'Unknown player'}
                          </div>
                        </div>
                        <div className="text-sm shrink-0" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display), Manrope, sans-serif', fontWeight: 500 }}>
                          {formatNzd(b.price_nzd)}
                        </div>
                      </div>
                      <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        {b.courts?.name} · {b.start_time.slice(0, 5)}–{b.end_time.slice(0, 5)}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                          style={{ background: 'var(--brand-primary-muted)', color: 'var(--brand-primary-text)' }}>
                          {b.status}
                        </span>
                        <span className="text-[10px] capitalize" style={{ color: 'var(--text-subtle)' }}>{b.payment_method?.replace('_', ' ')}</span>
                      </div>
                      {b.notes && (
                        <div className="text-xs mt-1.5 italic" style={{ color: 'var(--text-subtle)' }}>{b.notes}</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
