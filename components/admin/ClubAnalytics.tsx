'use client'

import MoneyBubble from '@/components/ui/MoneyBubble'
import { MONEY_HEX } from '@/lib/money-colours'
import { fmtClock, fmtHour } from '@/lib/clock'
import CardHeading from '@/components/ui/CardHeading'
import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import { formatPrice, currencyForRegion } from '@/lib/currency'
import { getVenue } from '@/lib/venues'
import OfferSheet from '@/components/admin/OfferSheet'
import { weekBounds, type WeekHours } from '@/lib/venue-hours'
import {
  PERIODS, computePeriodStats, describeVersusBefore, heatmapFor, nextDateOnWeekday, quietestSlot, quietestSlots, rangeLabel,
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
  const quietSlots = quietestSlots(heatmap, openHours, stats.bookings.value, 3)
  const [showAllHours, setShowAllHours] = useState(false)
  const hasData = stats.bookings.value > 0
  const todayDow = new Date(todayStr + 'T00:00:00').getDay()
  const hourLabel = (h: number) => fmtHour(`${String(h).padStart(2, '0')}:00`)
  const hourAvg = shownHours.map(h => ({ hour: h, v: Math.round(DAY_LABELS.reduce((a, _, d) => a + (byCell.get(`${d}-${h}`) ?? 0), 0) / 7) }))
  const dayAvg = [1, 2, 3, 4, 5, 6, 0].map(d => ({ dow: d, v: shownHours.length ? Math.round(shownHours.reduce((a, h) => a + (byCell.get(`${d}-${h}`) ?? 0), 0) / shownHours.length) : 0 }))
  const maxDay = Math.max(1, ...dayAvg.map(d => d.v))
  const quietHours = new Set(hasData ? [...hourAvg].sort((a, b) => a.v - b.v || a.hour - b.hour).slice(0, 3).map(x => x.hour) : [])
  const busyHours = new Set(hasData ? [...hourAvg].sort((a, b) => b.v - a.v || a.hour - b.hour).slice(0, 3).map(x => x.hour) : [])
  const collapsible = hourAvg.length > 8
  const busiest = heatmap.filter(c => shownHours.includes(c.hour)).reduce<typeof heatmap[number] | null>((best, c) => (c.occupancyPct > 0 && (best === null || c.occupancyPct > best.occupancyPct) ? c : best), null)
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
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <CardHeading as="h2" size="section" className="">Analytics</CardHeading>
        <div className="flex gap-1 rounded-lg p-1 w-full sm:w-auto" style={{ background: 'var(--bg-raised)' }} role="radiogroup" aria-label="Period">
          {PERIODS.map(p => (
            <button key={p} type="button" role="radio" aria-checked={days === p} data-testid={`period-${p}`} onClick={() => setDays(p)} data-on={days === p ? 'true' : undefined}
              className="wh-seg flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs font-medium transition-all"
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
              {d && (d.tone === 'flat'
                ? <div className="text-[11px] mt-1 font-semibold" style={{ color: TONE.flat }}>{d.text}</div>
                // these are counts (utilisation, bookings, players, members), so the bubble is blue; the arrow shows which way it went
                : <div className="mt-1.5" data-testid="kpi-change"><MoneyBubble kind="wait" size={11} wrap>{d.text}</MoneyBubble></div>)}
              {k.fixed && <div className="text-[10.5px] mt-1" style={{ color: 'var(--text-subtle)' }}>{k.fixed} · doesn&apos;t change with the period</div>}
            </div>
          )
        })}
      </div>

      {/* Busy and quiet hours: how full by hour and by day, and the quiet slots to fill. On a phone the quiet slots come first and the hours are cut to the six that matter. */}
      <div className="rounded-[20px] p-5 mb-5" style={{ background: 'var(--board-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }} data-testid="heatmap">
        <CardHeading className="mb-1">Busy and quiet hours</CardHeading>
        <div className="text-xs mb-3" style={{ color: 'var(--text-subtle)' }}>How full the courts were, last {days} days</div>
        {hasData && (
          <div className="flex flex-wrap gap-2 mb-4" data-testid="hours-chips">
            {busiest && <MoneyBubble kind="wait" size={12} testId="chip-busiest">Busiest <b>{DAY_LABELS[busiest.dayOfWeek]} {hourLabel(busiest.hour)}</b> · {busiest.occupancyPct}% full</MoneyBubble>}
            {quietSlots[0] && <MoneyBubble kind="none" size={12} testId="chip-quietest">Quietest <b>{DAY_LABELS[quietSlots[0].dayOfWeek]} {hourLabel(quietSlots[0].hour)}</b> · {quietSlots[0].pct}% full</MoneyBubble>}
            <span className="hidden md:inline-block"><MoneyBubble kind="wait" size={12}>Courts full <b>{stats.utilisation.value}%</b></MoneyBubble></span>
          </div>
        )}
        <div className="grid gap-4 md:gap-x-8 md:grid-cols-[1.15fr_1fr]">
          {quietSlots.length > 0 && (
            <div className="order-1 md:order-3 md:col-start-2 md:row-start-2" data-testid="quiet-callout">
              <div className="text-[11px] font-extrabold uppercase tracking-widest mb-1" style={{ color: 'var(--text-subtle)' }}>Quiet slots worth filling</div>
              {quietSlots.map((q, i) => (
                <div key={`${q.dayOfWeek}-${q.hour}`} className="flex items-center gap-3 py-2.5" style={{ borderTop: '1px solid var(--border)' }} data-testid="quiet-slot">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{DAY_PLURAL[q.dayOfWeek]} {hourLabel(q.hour)}</div>
                    <div className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>only {q.pct}% full over the last {days} days</div>
                  </div>
                  {offersOn && (
                    <button type="button" data-testid={i === 0 ? 'quiet-offer' : `quiet-offer-${i + 1}`} onClick={() => setOffer({ date: nextDateOnWeekday(todayStr, q.dayOfWeek), from: `${String(q.hour).padStart(2, '0')}:00`, to: `${String(q.hour + 1).padStart(2, '0')}:00` })}
                      className="text-xs font-extrabold uppercase tracking-wide px-4 py-2 rounded-full" style={{ background: 'var(--lime, #d4f53c)', color: '#17240a' }}>Offer</button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="order-2 md:order-2 md:col-start-2 md:row-start-1" data-testid="by-day">
            <div className="text-[11px] font-extrabold uppercase tracking-widest mb-2" style={{ color: 'var(--text-subtle)' }}>By day</div>
            <div className="flex gap-1.5">
              {dayAvg.map(d => {
                const isToday = d.dow === todayDow
                return (
                  <div key={d.dow} className="flex-1 min-w-0 text-center rounded-2xl pt-2 pb-1.5" data-today={isToday ? 'true' : undefined} data-testid="by-day-col"
                    style={isToday ? { background: 'var(--today-grad)', boxShadow: 'inset 0 0 0 1px var(--today-edge)' } : { background: 'var(--board-cell)' }}>
                    <div className="flex items-end justify-center" style={{ height: 84 }}>
                      <div style={{ width: '58%', height: `${Math.max(5, (d.v / maxDay) * 100)}%`, borderRadius: 99, background: MONEY_HEX.wait }} />
                    </div>
                    <div className="mx-1.5 mt-2 mb-0.5 rounded-xl text-[11px] font-extrabold flex items-center justify-center" style={{ height: 24, ...(isToday ? { background: 'var(--today-block-bg)', color: 'var(--today-block-fg)', boxShadow: 'var(--today-block-shadow)' } : { color: 'var(--text-muted)' }) }}>{DAY_LABELS[d.dow]}</div>
                    <div className="text-[11px] font-extrabold" style={{ color: 'var(--text-primary)' }}>{d.v}%</div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="order-3 md:order-1 md:col-start-1 md:row-start-1 md:row-span-2" data-testid="by-hour">
            <div className="text-[11px] font-extrabold uppercase tracking-widest mb-2" style={{ color: 'var(--text-subtle)' }}>By hour, all days</div>
            {hourAvg.map(h => {
              const isQuiet = quietHours.has(h.hour)
              const show = !collapsible || showAllHours || isQuiet || busyHours.has(h.hour)
              return (
                <div key={h.hour} data-testid="hour-row" data-quiet={isQuiet ? 'true' : undefined} className={`${show ? 'flex' : 'hidden md:flex'} items-center gap-2.5 mb-1.5`}>
                  <span className="text-[11px] font-extrabold shrink-0" style={{ width: 46, color: 'var(--text-muted)' }}>{hourLabel(h.hour)}</span>
                  <div className="flex-1 overflow-hidden" style={{ height: 18, background: 'var(--board-cell)', borderRadius: 99 }}>
                    <div style={{ width: `${Math.max(3, h.v)}%`, height: '100%', borderRadius: 99, background: isQuiet ? 'transparent' : MONEY_HEX.wait, boxShadow: isQuiet ? 'inset 0 0 0 2px var(--text-primary)' : undefined }} />
                  </div>
                  <b className="text-[11.5px] text-right shrink-0" style={{ width: 38, color: 'var(--text-primary)' }}>{h.v}%</b>
                </div>
              )
            })}
            {collapsible && (
              <button type="button" data-testid="hours-toggle" onClick={() => setShowAllHours(v => !v)} className="md:hidden text-xs font-bold mt-1 underline" style={{ color: 'var(--text-muted)' }}>
                {showAllHours ? 'Show fewer hours' : 'See every hour'}
              </button>
            )}
            <div className="flex items-center gap-1.5 mt-2 text-[10.5px] font-semibold" style={{ color: 'var(--text-muted)' }}>
              <span style={{ width: 16, height: 10, borderRadius: 3, border: '2px dashed var(--text-primary)', display: 'inline-block' }} />Quietest hours
            </div>
          </div>
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
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-subtle)' }}>No booking in the last 30 days · doesn&apos;t change with the period</div>
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
                <div className="text-[10px]" style={{ color: 'var(--text-subtle)' }}>{b.court_name} · {formatDate(b.date)} · {fmtClock(b.start_time)}</div>
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
