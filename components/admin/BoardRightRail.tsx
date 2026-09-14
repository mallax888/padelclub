'use client'

import { formatDate } from '@/lib/utils'
import { currencyForRegion, formatPrice } from '@/lib/currency'
import { getVenue } from '@/lib/venues'

type Slice = { label: string; count: number; color: string }

// Simple stroke-dasharray donut -- no charting library needed for 2-3
// segments. Same category colours as the Board grid itself (see
// AdminDashboard's cellAppearance) so this reads as one consistent system
// rather than an unrelated chart palette.
function Donut({ slices, total }: { slices: Slice[]; total: number }) {
  const size = 120
  const strokeWidth = 16
  const r = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * r
  let offset = 0

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-raised)" strokeWidth={strokeWidth} />
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {total > 0 && slices.filter(s => s.count > 0).map(s => {
          const length = (s.count / total) * circumference
          const el = (
            <circle key={s.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={strokeWidth}
              strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-offset} strokeLinecap="butt" />
          )
          offset += length
          return el
        })}
      </g>
      <text x={size / 2} y={size / 2 - 4} textAnchor="middle" fontSize="22" fontWeight="800" fill="var(--text-primary)">{total}</text>
      <text x={size / 2} y={size / 2 + 14} textAnchor="middle" fontSize="10" fill="var(--text-subtle)">bookings</text>
    </svg>
  )
}

export type RailBooking = {
  id: string
  date: string
  start_time: string
  court_name: string
  member_name: string
  price_nzd: number
  venue_slug?: string | null
}

export default function BoardRightRail({
  todayCounts,
  upcomingBookings,
  onBlockCourt,
  onAddCourt,
}: {
  todayCounts: { regular: number; openPlay: number; blocked: number }
  upcomingBookings: RailBooking[]
  onBlockCourt: () => void
  onAddCourt: () => void
}) {
  const total = todayCounts.regular + todayCounts.openPlay + todayCounts.blocked
  const slices: Slice[] = [
    { label: 'Bookings', count: todayCounts.regular, color: 'var(--brand-primary)' },
    { label: 'Open Play', count: todayCounts.openPlay, color: '#10B981' },
    { label: 'Blocked', count: todayCounts.blocked, color: 'var(--brand-crimson)' },
  ]

  return (
    <div className="w-full lg:w-72 shrink-0 space-y-4">
      <div className="rounded-2xl p-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
        <div className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Today's Bookings Overview</div>
        <div className="flex items-center gap-4">
          <Donut slices={slices} total={total} />
          <div className="space-y-2 flex-1 min-w-0">
            {slices.map(s => (
              <div key={s.label} className="flex items-center gap-2 text-xs">
                <span style={{ width: 8, height: 8, borderRadius: 999, background: s.color, flexShrink: 0 }} />
                <span className="truncate" style={{ color: 'var(--text-muted)' }}>{s.label}</span>
                <span className="ml-auto font-semibold" style={{ color: 'var(--text-primary)' }}>{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl p-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
        <div className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Quick Actions</div>
        <div className="space-y-2">
          <button onClick={onBlockCourt} className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: 'var(--brand-primary)', color: 'var(--brand-primary-on)', boxShadow: 'var(--glow-primary)' }}>
            🔒 Block a court <span>→</span>
          </button>
          <button onClick={onAddCourt} className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: 'var(--bg-raised)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
            + Add a court <span>→</span>
          </button>
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-raised)' }}>
          <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Upcoming Bookings</div>
        </div>
        {upcomingBookings.length === 0 ? (
          <div className="px-4 py-6 text-sm text-center" style={{ color: 'var(--text-subtle)' }}>Nothing booked yet.</div>
        ) : (
          <div>
            {upcomingBookings.map(b => {
              const currency = currencyForRegion(b.venue_slug ? getVenue(b.venue_slug).region : undefined)
              return (
                <div key={b.id} className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
                  <div className="min-w-0">
                    <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{b.member_name}</div>
                    <div className="text-[10px]" style={{ color: 'var(--text-subtle)' }}>{b.court_name} · {formatDate(b.date)} · {b.start_time.slice(0, 5)}</div>
                  </div>
                  <div className="text-xs font-semibold shrink-0 pl-2" style={{ color: 'var(--brand-primary-text)' }}>
                    {b.price_nzd > 0 ? formatPrice(b.price_nzd, currency) : '—'}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
