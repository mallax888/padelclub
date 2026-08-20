'use client'

import { formatNzd } from '@/lib/utils'
import type { ClubAnalytics as ClubAnalyticsData } from '@/lib/analytics'

export default function ClubAnalytics({ data }: { data: ClubAnalyticsData }) {
  const { utilization7d, uniquePlayers30d, revenue30d, activeMembers, weeklyTrend, atRisk } = data
  const maxBookings = Math.max(1, ...weeklyTrend.map(w => w.bookings))

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Court utilization (7d)', value: `${utilization7d}%`, color: 'var(--brand-primary-text)' },
          { label: 'Unique players (30d)', value: uniquePlayers30d, color: 'var(--text-primary)' },
          { label: 'Booking revenue (30d)', value: formatNzd(revenue30d), color: 'var(--brand-primary-text)' },
          { label: 'Active members', value: activeMembers, color: 'var(--brand-accent)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-2xl p-4"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
            <div className="text-xs mb-1" style={{ color: 'var(--text-subtle)' }}>{label}</div>
            <div className="text-xl font-semibold" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Weekly bookings trend */}
        <div className="lg:col-span-3 rounded-2xl p-5"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
          <div className="text-sm font-medium mb-4" style={{ color: 'var(--text-primary)' }}>Bookings per week</div>
          <div className="flex items-end gap-2" style={{ height: 140 }}>
            {weeklyTrend.map((w, i) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full" title={`${w.bookings} bookings · ${formatNzd(w.revenue)}`}>
                <div className="text-[10px] mb-1" style={{ color: 'var(--text-subtle)' }}>{w.bookings || ''}</div>
                <div className="w-full rounded-t"
                  style={{
                    height: `${Math.max(4, (w.bookings / maxBookings) * 100)}%`,
                    background: i === weeklyTrend.length - 1 ? 'var(--brand-primary)' : 'var(--bg-raised)',
                    minHeight: 4,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            {weeklyTrend.map((w, i) => (
              <div key={i} className="flex-1 text-center text-[10px]" style={{ color: 'var(--text-subtle)' }}>{w.label}</div>
            ))}
          </div>
        </div>

        {/* At-risk members */}
        <div className="lg:col-span-2 rounded-2xl overflow-hidden"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-raised)' }}>
            <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Members drifting away</div>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-subtle)' }}>No booking in the last 30 days</div>
          </div>
          {atRisk.length === 0 ? (
            <div className="px-4 py-6 text-sm text-center" style={{ color: 'var(--text-subtle)' }}>
              Nobody's drifting — everyone's booked recently 🎉
            </div>
          ) : (
            <div>
              {atRisk.map(m => (
                <div key={m.id} className="flex items-center justify-between px-4 py-2.5"
                  style={{ borderBottom: '1px solid var(--border)' }}>
                  <div className="min-w-0">
                    <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{m.name}</div>
                    <div className="text-[10px] capitalize" style={{ color: 'var(--text-subtle)' }}>{m.tier}</div>
                  </div>
                  <div className="text-[10px] font-medium shrink-0 pl-2 text-right" style={{ color: 'var(--brand-accent)' }}>
                    {m.daysSinceLastBooking === null ? 'No activity in 90+ days' : `${m.daysSinceLastBooking} days ago`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
