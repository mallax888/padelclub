'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { cn, formatNzd, formatDate, generateTimeSlots, getNextNDates } from '@/lib/utils'
import type { Court, Profile } from '@/types/database'

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
  const supabase = createClient()
  const router = useRouter()
  const [tab, setTab] = useState<'bookings' | 'members' | 'courts'>('bookings')
  const [showBlock, setShowBlock] = useState(false)
  const [blockForm, setBlockForm] = useState({
    courtId: courts[0]?.id ?? '',
    date: getNextNDates(1)[0],
    time: '09:00',
    notes: '',
  })

  const today = new Date().toISOString().slice(0, 10)
  const todayBookings = bookings.filter(b => b.date === today && b.status !== 'cancelled')
  const revenue = bookings.filter(b=>b.status==='confirmed').reduce((s,b)=>s+b.price_nzd, 0)
  const memberCount = members.filter(m=>m.membership_tier !== 'casual').length

  const cancelBooking = async (id: string) => {
    if (!confirm('Cancel this booking?')) return
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id)
    toast.success('Booking cancelled')
    router.refresh()
  }

  const blockCourt = async () => {
    const court = courts.find(c => c.id === blockForm.courtId)
    if (!court) return
    const { error } = await supabase.from('bookings').insert({
      user_id: (await supabase.auth.getUser()).data.user!.id,
      court_id: blockForm.courtId,
      date: blockForm.date,
      start_time: blockForm.time + ':00',
      end_time: blockForm.time.replace(/(\d+)/, h => String(parseInt(h)+1).padStart(2,'0')) + ':00',
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
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Today's bookings", value: todayBookings.length },
          { label: 'Total bookings', value: bookings.filter(b=>b.status==='confirmed').length },
          { label: 'Paying members', value: memberCount },
          { label: 'Revenue (confirmed)', value: formatNzd(revenue) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-1">{label}</div>
            <div className="text-xl font-semibold">{value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {(['bookings','members','courts'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn('px-4 py-2 text-sm capitalize border-b-2 -mb-px transition-colors', tab===t ? 'border-brand-400 text-brand-600 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700')}
          >
            {t}
          </button>
        ))}
        <div className="flex-1" />
        {tab === 'bookings' && (
          <button className="btn btn-sm btn-primary mb-1" onClick={() => setShowBlock(true)}>
            🔒 Block a court
          </button>
        )}
      </div>

      {/* Bookings tab */}
      {tab === 'bookings' && (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Member','Court','Date','Time','Amount','Status',''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-gray-400 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bookings.map(b => (
                <tr key={b.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{b.profiles?.full_name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{b.courts?.name}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(b.date)}</td>
                  <td className="px-4 py-3 text-gray-500">{b.start_time.slice(0,5)}</td>
                  <td className="px-4 py-3 font-medium">{b.price_nzd > 0 ? formatNzd(b.price_nzd) : '—'}</td>
                  <td className="px-4 py-3"><span className={cn('badge', `status-${b.status}`)}>{b.status}</span></td>
                  <td className="px-4 py-3">
                    {b.status !== 'cancelled' && b.status !== 'blocked' && (
                      <button className="btn btn-danger btn-sm" onClick={() => cancelBooking(b.id)}>Cancel</button>
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
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Name','Membership','Credits','Role','Joined'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-gray-400 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map(m => (
                <tr key={m.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{m.full_name ?? '—'}</td>
                  <td className="px-4 py-3"><span className="badge badge-member capitalize">{m.membership_tier}</span></td>
                  <td className="px-4 py-3">{m.credits}</td>
                  <td className="px-4 py-3 text-gray-500 capitalize">{m.role}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{m.created_at.slice(0,10)}</td>
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
            <div key={c.id} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-sm text-gray-500">{c.is_indoor ? '🏢' : '☀️'} {c.type} · {c.sport}</div>
                </div>
                <span className={cn('badge', c.is_active ? 'badge-member' : 'status-cancelled')}>
                  {c.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="mt-3 text-sm text-gray-500">
                {formatNzd(c.price_per_hour)}/hr · {c.surface}
              </div>
              {c.description && <div className="text-xs text-gray-400 mt-1">{c.description}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Block court modal */}
      {showBlock && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={e => e.target === e.currentTarget && setShowBlock(false)}
        >
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl border border-gray-200">
            <div className="font-semibold text-base mb-4">Block court time</div>
            <div className="space-y-3">
              <div>
                <label className="label">Court</label>
                <select className="input" value={blockForm.courtId} onChange={e=>setBlockForm(f=>({...f,courtId:e.target.value}))}>
                  {courts.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Date</label>
                  <input type="date" className="input" value={blockForm.date} onChange={e=>setBlockForm(f=>({...f,date:e.target.value}))} />
                </div>
                <div>
                  <label className="label">Time</label>
                  <select className="input" value={blockForm.time} onChange={e=>setBlockForm(f=>({...f,time:e.target.value}))}>
                    {TIME_SLOTS.map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Reason (optional)</label>
                <input type="text" className="input" placeholder="Maintenance, private event…" value={blockForm.notes} onChange={e=>setBlockForm(f=>({...f,notes:e.target.value}))} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button className="btn flex-1 justify-center" onClick={()=>setShowBlock(false)}>Cancel</button>
              <button className="btn btn-primary flex-1 justify-center" onClick={blockCourt}>Block court</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
