'use client'

import { useState, Fragment } from 'react'
import { localDateStr, formatDate } from '@/lib/utils'
import { formatPrice, formatMultiCurrency, currencyForRegion } from '@/lib/currency'
import { getVenue } from '@/lib/venues'
import { computeCourtPerformance, computeOccupancyHeatmap, type ClubAnalytics as ClubAnalyticsData, type CourtPerformanceBooking, type CourtPerformancePeriod, type OccupancyBooking } from '@/lib/analytics'

export type UpcomingBooking = {
  id: string
  date: string
  start_time: string
  court_name: string
  member_name: string
  price_nzd: number
  venue_slug?: string | null
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function ClubAnalytics({
  data,
  courtPerfBookings,
  heatmapBookings,
  courtCount,
  upcomingBookings,
}: {
  data: ClubAnalyticsData
  courtPerfBookings: CourtPerformanceBooking[]
  heatmapBookings: OccupancyBooking[]
  courtCount: number
  upcomingBookings: UpcomingBooking[]
}) {
  const { utilization7d, uniquePlayers30d, revenueByCurrency30d, activeMembers, weeklyTrend, atRisk, retentionRate, newMembers30d } = data
  const maxBookings = Math.max(1, ...weeklyTrend.map(w => w.bookings))

  const [courtPerfPeriod, setCourtPerfPeriod] = useState<CourtPerformancePeriod>('month')
  const courtPerformance = computeCourtPerformance(courtPerfBookings, localDateStr(), courtPerfPeriod)
  const maxCourtRevenue = Math.max(1, ...courtPerformance.map(c => c.revenue))

  const heatmap = computeOccupancyHeatmap(heatmapBookings, courtCount, localDateStr())
  const heatmapByCell = new Map(heatmap.map(c => [`${c.dayOfWeek}-${c.hour}`, c.occupancyPct]))
  const hours = Array.from(new Set(heatmap.map(c => c.hour))).sort((a, b) => a - b)

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        {[
          { label: 'Court utilization (7d)', value: `${utilization7d}%`, color: 'var(--brand-primary-text)' },
          { label: 'Unique players (30d)', value: uniquePlayers30d, color: 'var(--text-primary)' },
          { label: 'Booking revenue (30d)', value: formatMultiCurrency(revenueByCurrency30d), color: 'var(--brand-primary-text)' },
          { label: 'Active members', value: activeMembers, color: 'var(--brand-accent)' },
          { label: 'Retention (60d+ members)', value: retentionRate === null ? '—' : `${retentionRate}%`, color: 'var(--brand-primary-text)' },
          { label: 'New members (30d)', value: newMembers30d, color: 'var(--brand-accent)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-2xl p-4"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
            <div className="text-xs mb-1" style={{ color: 'var(--text-subtle)' }}>{label}</div>
            <div className="text-xl font-semibold" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Court performance */}
      <div className="rounded-2xl p-5 mb-4"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Most popular courts by revenue</div>
          <div className="flex gap-1 rounded-lg p-1" style={{ background: 'var(--bg-raised)' }}>
            {(['week', 'month', 'year'] as const).map(p => (
              <button key={p} onClick={() => setCourtPerfPeriod(p)}
                className="px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all"
                style={{ background: courtPerfPeriod === p ? 'var(--brand-primary)' : 'transparent', color: courtPerfPeriod === p ? 'var(--brand-primary-on)' : 'var(--text-muted)' }}>
                {p}
              </button>
            ))}
          </div>
        </div>
        {courtPerformance.length === 0 ? (
          <div className="text-sm text-center py-6" style={{ color: 'var(--text-subtle)' }}>
            No bookings in this period yet.
          </div>
        ) : (
          <div className="space-y-3">
            {courtPerformance.map(c => (
              <div key={c.courtId}>
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{c.courtName}</div>
                  <div className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
                    {formatPrice(c.revenue, c.currency)} · {c.bookings} {c.bookings === 1 ? 'booking' : 'bookings'}
                  </div>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-raised)' }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.max(2, (c.revenue / maxCourtRevenue) * 100)}%`, background: 'var(--brand-primary)' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Occupancy heatmap */}
      <div className="rounded-2xl p-5 mb-4 overflow-x-auto"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
        <div className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>When the club gets busy</div>
        <div className="text-xs mb-4" style={{ color: 'var(--text-subtle)' }}>Occupancy by day and hour, last 28 days</div>
        <div style={{ display: 'grid', gridTemplateColumns: `44px repeat(7, 1fr)`, gap: 3, minWidth: 420 }}>
          <div />
          {DAY_LABELS.map(d => (
            <div key={d} className="text-center text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>{d}</div>
          ))}
          {hours.map(hour => (
            <Fragment key={hour}>
              <div className="text-[10px] font-medium flex items-center" style={{ color: 'var(--text-muted)' }}>
                {String(hour).padStart(2, '0')}:00
              </div>
              {DAY_LABELS.map((_, dow) => {
                const pct = heatmapByCell.get(`${dow}-${hour}`) ?? 0
                return (
                  <div key={`${dow}-${hour}`} title={`${pct}% occupied`}
                    style={{ height: 16, borderRadius: 3, background: pct === 0 ? 'var(--bg-raised)' : 'var(--brand-primary)', opacity: pct === 0 ? 1 : Math.max(0.18, pct / 100) }} />
                )
              })}
            </Fragment>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-3 text-[10px]" style={{ color: 'var(--text-subtle)' }}>
          <span>Quiet</span>
          <div style={{ width: 60, height: 8, borderRadius: 4, background: 'linear-gradient(90deg, var(--bg-raised), var(--brand-primary))' }} />
          <span>Busy</span>
        </div>
      </div>

      {/* Upcoming bookings */}
      <div className="rounded-2xl overflow-hidden mb-4"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-raised)' }}>
          <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Upcoming bookings</div>
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

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Weekly bookings trend */}
        <div className="lg:col-span-3 rounded-2xl p-5"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
          <div className="text-sm font-medium mb-4" style={{ color: 'var(--text-primary)' }}>Bookings per week</div>
          <div className="flex items-end gap-2" style={{ height: 140 }}>
            {weeklyTrend.map((w, i) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full" title={`${w.bookings} bookings · ${formatMultiCurrency(w.revenueByCurrency)}`}>
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
