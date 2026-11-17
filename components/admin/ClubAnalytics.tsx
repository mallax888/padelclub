'use client'

import CardHeading from '@/components/ui/CardHeading'
import { useState, Fragment, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import { formatPrice, currencyForRegion } from '@/lib/currency'
import { getVenue } from '@/lib/venues'
import OfferSheet from '@/components/admin/OfferSheet'
import { weekBounds, type WeekHours } from '@/lib/venue-hours'
import {
  PERIODS, computePeriodStats, describeVersusBefore, heatmapFor, nextDateOnWeekday, quietestSlot, rangeLabel,
  type Compared, type PeriodBooking, type PeriodMember,
} from '@/lib/analytics-period'

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
const DAY_PLURAL = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays']
const card = { background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' } as const
const TONE = { up: 'var(--brand-green, #34D399)', down: 'var(--brand-crimson)', flat: 'var(--text-subtle)' } as const

// The Analytics tab: how busy the club is and where it is quiet. One period switch
// (7, 30, 60 or 90 days) drives the whole page, and every figure is set beside the
// same stretch just before it. Takings and courts by revenue live in Reports.
export default function ClubAnalytics({
  rows, members, courtCount, venueSlug, week, offersOn, todayStr, upcomingBookings, children,
}: {
  rows: PeriodBooking[]
  members: PeriodMember[]
  courtCount: number
  venueSlug: string
  week: WeekHours | null
  offersOn: boolean // false until the offers database change has been run: no Send an offer button
  todayStr: string
  upcomingBookings: UpcomingBooking[]
  children?: ReactNode // the Money & demand section, shown between the busy hours and the trend
}) {
  const router = useRouter()
  const [days, setDays] = useState<number>(30)
  const [offer, setOffer] = useState<{ date: string; from: string; to: string } | null>(null)

  const { firstHour, lastHour } = weekBounds(week)
  const openHours = Array.from({ length: Math.max(0, Math.min(lastHour, 24) - firstHour) }, (_, i) => firstHour + i)
  const stats = computePeriodStats(rows, members, courtCount, Math.max(1, openHours.length), todayStr, days)
  const heatmap = heatmapFor(rows, courtCount, todayStr, days)
  const byCell = new Map(heatmap.map(c => [`${c.dayOfWeek}-${c.hour}`, c.occupancyPct]))
  const shownHours = openHours.length > 0 ? openHours : Array.from(new Set(heatmap.map(c => c.hour))).sort((a, b) => a - b)
  const quiet = quietestSlot(heatmap, openHours, stats.bookings.value)
  const maxTrend = Math.max(1, ...stats.trend.map(t => t.bookings))

  const kpis: { label: string; value: string | number; cmp?: { c: Compared; points?: boolean }; fixed?: string }[] = [
    { label: 'Court utilisation', value: `${stats.utilisation.value}%`, cmp: { c: stats.utilisation, points: true } },
    { label: 'Bookings', value: stats.bookings.value, cmp: { c: stats.bookings } },
    { label: 'Unique players', value: stats.players.value, cmp: { c: stats.players } },
    { label: 'New members', value: stats.newMembers.value, cmp: { c: stats.newMembers } },
    { label: 'Active members', value: stats.activeMembers, fixed: 'right now' },
    { label: 'Retention', value: stats.retention === null ? '—' : `${stats.retention}%`, fixed: 'members of 60+ days, last 30 days' },
  ]

  return (
    <div data-testid="analytics-tab">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <CardHeading as="h2" size="section" className="">Analytics</CardHeading>
        <div className="flex gap-1 rounded-lg p-1 w-full sm:w-auto" style={{ background: 'var(--bg-raised)' }} role="radiogroup" aria-label="Period">
          {PERIODS.map(p => (
            <button key={p} type="button" role="radio" aria-checked={days === p} data-testid={`period-${p}`} onClick={() => setDays(p)}
              className="flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{ background: days === p ? 'var(--brand-primary)' : 'transparent', color: days === p ? 'var(--brand-primary-on, #fff)' : 'var(--text-muted)' }}>
              {p} days
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs mb-4" style={{ color: 'var(--text-subtle)' }} data-testid="period-range">{rangeLabel(todayStr, days)}</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-5" data-testid="kpis">
        {kpis.map(k => {
          const d = k.cmp ? describeVersusBefore(k.cmp.c, days, k.cmp.points) : null
          return (
            <div key={k.label} className="rounded-2xl p-4" style={card} data-testid="kpi">
              <div className="text-xs mb-1" style={{ color: 'var(--text-subtle)' }}>{k.label}</div>
              <div className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{k.value}</div>
              {d && <div className="text-[11px] mt-1 font-semibold" style={{ color: TONE[d.tone] }}>{d.text}</div>}
              {k.fixed && <div className="text-[10.5px] mt-1" style={{ color: 'var(--text-subtle)' }}><span className="px-1.5 py-0.5 rounded-md mr-1" style={{ background: 'var(--bg-raised)' }}>fixed</span>{k.fixed}</div>}
            </div>
          )
        })}
      </div>

      {/* Busy and quiet hours */}
      <div className="rounded-2xl p-5 mb-5 overflow-x-auto scrollbar-thin" style={card} data-testid="heatmap">
        <CardHeading className="mb-2">Busy and quiet hours</CardHeading>
        <div className="text-xs mb-3" style={{ color: 'var(--text-subtle)' }}>How full the courts were by day and hour, last {days} days</div>
        {quiet && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-3 py-2.5 mb-4" data-testid="quiet-callout"
            style={{ background: 'color-mix(in srgb, var(--brand-yellow) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--brand-yellow) 40%, transparent)' }}>
            <div className="text-[13px]" style={{ color: 'var(--text-primary)' }}>
              <b>Quietest regular slot:</b> {DAY_PLURAL[quiet.dayOfWeek]} {String(quiet.hour).padStart(2, '0')}:00, only {quiet.pct}% full.
            </div>
            {offersOn && (
              <button type="button" data-testid="quiet-offer" onClick={() => setOffer({ date: nextDateOnWeekday(todayStr, quiet.dayOfWeek), from: `${String(quiet.hour).padStart(2, '0')}:00`, to: `${String(quiet.hour + 1).padStart(2, '0')}:00` })}
                className="text-xs font-extrabold px-3 py-1.5 rounded-full" style={{ background: 'var(--brand-primary)', color: '#fff' }}>Send an offer</button>
            )}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: `44px repeat(7, 1fr)`, gap: 3, minWidth: 420 }}>
          <div />
          {DAY_LABELS.map(d => (
            <div key={d} className="text-center text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>{d}</div>
          ))}
          {shownHours.map(hour => (
            <Fragment key={hour}>
              <div className="text-[10px] font-medium flex items-center" style={{ color: 'var(--text-muted)' }}>{String(hour).padStart(2, '0')}:00</div>
              {DAY_LABELS.map((_, dow) => {
                const pct = byCell.get(`${dow}-${hour}`) ?? 0
                const isQuiet = quiet && quiet.dayOfWeek === dow && quiet.hour === hour
                return (
                  <div key={`${dow}-${hour}`} title={`${DAY_LABELS[dow]} ${String(hour).padStart(2, '0')}:00 · ${pct}% full`} data-quiet={isQuiet ? 'true' : undefined}
                    style={{ height: 16, borderRadius: 3, background: pct === 0 ? 'var(--bg-raised)' : 'var(--brand-primary)', opacity: pct === 0 ? 1 : Math.max(0.18, pct / 100), outline: isQuiet ? '2px solid var(--brand-yellow)' : undefined }} />
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

      {children}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
        <div className="lg:col-span-3 rounded-2xl p-5" style={card} data-testid="trend">
          <CardHeading>{days <= 7 ? 'Bookings per day' : 'Bookings per week'}</CardHeading>
          <div className="flex items-end gap-2" style={{ height: 140 }}>
            {stats.trend.map((w, i) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full" title={`${w.bookings} bookings`}>
                <div className="text-[10px] mb-1" style={{ color: 'var(--text-subtle)' }}>{w.bookings || ''}</div>
                <div className="w-full rounded-t" style={{ height: `${Math.max(4, (w.bookings / maxTrend) * 100)}%`, background: i === stats.trend.length - 1 ? 'var(--brand-primary)' : 'var(--bg-raised)', minHeight: 4 }} />
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            {stats.trend.map((w, i) => (
              // Thirteen weekly bars leave no room for every date on a phone: label every other one, ending on the latest.
              <div key={i} className="flex-1 min-w-0 text-center text-[10px] whitespace-nowrap overflow-visible" style={{ color: 'var(--text-subtle)' }}>
                {stats.trend.length > 9 && (stats.trend.length - 1 - i) % 2 !== 0 ? '' : <span className="inline-block max-w-full">{w.label}</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 rounded-2xl overflow-hidden" style={card} data-testid="drifting">
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-raised)' }}>
            <CardHeading className="mb-2">Members drifting away</CardHeading>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-subtle)' }}><span className="px-1.5 py-0.5 rounded-md mr-1" style={{ background: 'var(--bg-surface)' }}>fixed</span>No booking in the last 30 days</div>
          </div>
          {stats.drifting.length === 0 ? (
            <div className="px-4 py-6 text-sm text-center" style={{ color: 'var(--text-subtle)' }}>Nobody&apos;s drifting. Everyone has booked recently.</div>
          ) : stats.drifting.map(m => (
            <div key={m.id} className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="min-w-0">
                <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{m.name}</div>
                <div className="text-[10px] capitalize" style={{ color: 'var(--text-subtle)' }}>{m.tier}</div>
              </div>
              <div className="text-[10px] font-medium shrink-0 pl-2 text-right" style={{ color: 'var(--brand-accent)' }}>
                {m.daysSince === null ? 'No activity in 90+ days' : `${m.daysSince} days ago`}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden mb-4" style={card}>
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-raised)' }}>
          <CardHeading className="">Upcoming bookings</CardHeading>
        </div>
        {upcomingBookings.length === 0 ? (
          <div className="px-4 py-6 text-sm text-center" style={{ color: 'var(--text-subtle)' }}>Nothing booked yet.</div>
        ) : upcomingBookings.map(b => {
          const currency = currencyForRegion(b.venue_slug ? getVenue(b.venue_slug).region : undefined)
          return (
            <div key={b.id} className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="min-w-0">
                <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{b.member_name}</div>
                <div className="text-[10px]" style={{ color: 'var(--text-subtle)' }}>{b.court_name} · {formatDate(b.date)} · {b.start_time.slice(0, 5)}</div>
              </div>
              <div className="text-xs font-semibold shrink-0 pl-2" style={{ color: 'var(--brand-primary-text)' }}>{b.price_nzd > 0 ? formatPrice(b.price_nzd, currency) : '—'}</div>
            </div>
          )
        })}
      </div>

      {offer && <OfferSheet venueSlug={venueSlug} date={offer.date} from={offer.from} to={offer.to} bounds={{ from: `${String(firstHour).padStart(2, '0')}:00`, to: `${String(Math.min(lastHour, 24)).padStart(2, '0')}:00` }} onClose={() => setOffer(null)} onSent={() => { setOffer(null); router.refresh() }} />}
    </div>
  )
}
