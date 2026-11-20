'use client'

import { fmtClock } from '@/lib/clock'
import { GO } from '@/lib/accent'
import CardHeading from '@/components/ui/CardHeading'
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
  overviewLabel = "Today's Bookings",
  todayCounts,
  upcomingBookings,
  onBlockCourt,
  onAddCourt,
}: {
  // The donut counts whatever range the board is showing, so its title
  // has to follow the same selector rather than always saying "Today's".
  overviewLabel?: string
  todayCounts: { regular: number; openPlay: number; blocked: number }
  upcomingBookings: RailBooking[]
  onBlockCourt: () => void
  onAddCourt: () => void
}) {
  const total = todayCounts.regular + todayCounts.openPlay + todayCounts.blocked
  const slices: Slice[] = [
    { label: 'Bookings', count: todayCounts.regular, color: 'var(--brand-primary)' },
    { label: 'Open play', count: todayCounts.openPlay, color: '#10B981' },
    { label: 'Blocked', count: todayCounts.blocked, color: 'var(--brand-crimson)' },
  ]

  return (
    <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="rounded-2xl p-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
        <CardHeading>{overviewLabel} Overview</CardHeading>
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
        <CardHeading>Quick Actions</CardHeading>
        <div className="flex flex-col gap-4">
          <button onClick={onBlockCourt} className="btn-main !justify-between px-4" style={GO}>
            🔒 Block a court <span>→</span>
          </button>
          <button onClick={onAddCourt} className="btn-main btn-main-quiet !justify-between px-4">
            + Add a court <span>→</span>
          </button>
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-raised)' }}>
          <CardHeading className="">Upcoming Bookings</CardHeading>
        </div>
        {upcomingBookings.length === 0 ? (
          <div className="px-4 py-6 text-sm text-center" style={{ color: 'var(--text-subtle)' }}>Nothing booked yet.</div>
        ) : (
          <div>
            {upcomingBookings.map(b => {
              const currency = currencyForRegion(b.venue_slug ? getVenue(b.venue_slug).region : undefined)
              const dt = new Date(`${b.date}T12:00:00Z`)
              return (
                <div key={b.id} className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
                  <span aria-hidden className="shrink-0 inline-flex flex-col items-center justify-center text-white text-center" style={{ width: 44, height: 44, borderRadius: 13, background: 'linear-gradient(160deg,#2c5fc4,#1d3f8d)' }}>
                    <span style={{ fontSize: 8, letterSpacing: '0.1em', fontWeight: 700, lineHeight: 1.1 }}>{['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][dt.getUTCDay()]}</span>
                    <span style={{ fontSize: 17, fontWeight: 800, lineHeight: 1 }}>{dt.getUTCDate()}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>{b.member_name}</div>
                    <div className="text-[10.5px]" style={{ color: 'var(--text-subtle)' }}>{b.court_name} · {formatDate(b.date)} · {fmtClock(b.start_time)}</div>
                  </div>
                  <div className="text-xs font-extrabold shrink-0 pl-2" style={{ color: 'var(--text-primary)' }}>
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
