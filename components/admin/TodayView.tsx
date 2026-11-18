import Link from 'next/link'
import { formatPrice, type CurrencyCode } from '@/lib/currency'
import type { TodaySummary } from '@/lib/today'
import ViewSwitch from '@/components/ui/ViewSwitch'
import { AutoRefresh, VenuePicker } from '@/components/admin/TodayControls'
import YesterdayStrip from '@/components/admin/YesterdayStrip'
import { FillButton, OverdueRow } from '@/components/admin/TodayActionRows'
import ClubMap from '@/components/admin/ClubMap'
import type { MapBooking } from '@/lib/club-map'
import type { CourtDay } from '@/lib/court-day'
import type { Briefing } from '@/lib/briefing'
import type { FillGap, OverdueLine } from '@/lib/today-actions'

const display = { fontFamily: 'var(--font-display), Manrope, sans-serif' } as const
const card = { background: 'var(--bg-surface)', border: '1px solid var(--border)' } as const
const sectionLabel = { letterSpacing: '0.14em', color: 'var(--text-subtle)' } as const

export type TodayViewProps = {
  venueSlug: string
  canSwitchView?: boolean // false once club accounts are kept out of the player side
  venues: { slug: string; name: string }[]
  greeting: string
  staffName: string | null
  dateLabel: string
  lastWeekLabel: string // e.g. "Wed"
  currency: CurrencyCode
  summary: TodaySummary
  // total is null for front desk, who see how many shares are owed but not how much
  unpaid: { count: number; total: number | null; oldestDays: number | null }
  openSeats: { count: number; soonest: string | null }
  emptyHoursToday: number
  courtDay: CourtDay // each court, hour by hour, for the card that replaces "Courts right now"
  nowMinutes: number // the club's own time, in minutes since midnight
  map: { courts: { id: string; name: string; today: number; lastWeek: number }[]; bookings: MapBooking[]; takings: number; bounds: { from: string; to: string } | null; date: string }
  closeToday: string | null // when the club closes today (null = closed all day)
  notOpenYet: boolean // owners only: the club has courts but isn't open for booking
  showMoney: boolean // owners see money; front desk does not
  roleLabel: string | null
  // Owners only: yesterday at a glance, the same numbers as the morning message.
  briefing?: { b: Briefing; weekday: string; yesterdayLabel: string; brandNew?: boolean } | null
  // Owners only: what the Fill and Remind buttons act on.
  actions?: {
    overdue: { lines: OverdueLine[]; total: number; notDueCount: number; notDueTotal: number } | null
    offersOn: boolean // the offers database change has been run
    fill: { gap: FillGap; bounds: { from: string; to: string } } | null // null: nothing left that can be offered today
    autoOpen: 'fill' | 'remind' | null // opened from a phone or email link
  } | null
}

function AttentionRow({ href, tone, mark, title, text }: { href: string; tone: 'red' | 'yellow' | 'blue'; mark: string; title: string; text: string }) {
  const color = tone === 'red' ? 'var(--brand-crimson)' : tone === 'yellow' ? 'var(--text-primary)' : 'var(--brand-primary-text)'
  const bg = tone === 'red' ? 'var(--brand-crimson-muted)' : tone === 'yellow' ? 'var(--brand-yellow-muted)' : 'var(--brand-primary-muted)'
  return (
    <Link href={href} className="flex items-center gap-3 px-3.5 py-3" style={{ minHeight: 60, borderBottom: '1px solid var(--border)' }}>
      <span aria-hidden className="inline-flex items-center justify-center rounded-[11px] font-extrabold shrink-0" style={{ width: 34, height: 34, background: bg, color }}>{mark}</span>
      <span className="min-w-0">
        <span className="block text-[13.5px] font-bold" style={{ color: 'var(--text-primary)' }}>{title}</span>
        <span className="block text-[11.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{text}</span>
      </span>
      <span aria-hidden className="ml-auto text-lg" style={{ color: 'var(--text-subtle)' }}>›</span>
    </Link>
  )
}

export default function TodayView(p: TodayViewProps) {
  const { summary: s, unpaid, openSeats } = p
  const q = `venue=${encodeURIComponent(p.venueSlug)}`
  const attention: React.ReactNode[] = []
  const act = p.showMoney ? p.actions : null
  if (act?.overdue && act.overdue.lines.length > 0) {
    // Owners: the overdue shares, with a button that reminds everyone who owes, right here.
    attention.push(<OverdueRow key="overdue" currency={p.currency} lines={act.overdue.lines} total={act.overdue.total} notDueCount={act.overdue.notDueCount} notDueTotal={act.overdue.notDueTotal} autoOpen={act.autoOpen === 'remind'} />)
  } else if (unpaid.count > 0) {
    attention.push(
      <AttentionRow key="unpaid" href={p.showMoney ? `/admin?tab=analytics&${q}` : `/admin?tab=bookings&${q}`} tone="red" mark="$"
        title={`${unpaid.count} unpaid ${unpaid.count === 1 ? 'share' : 'shares'}${unpaid.total !== null ? ` · ${formatPrice(unpaid.total, p.currency)}` : ''}`}
        text={act ? 'None are overdue yet. Those remind themselves.' : unpaid.oldestDays !== null ? `Oldest is ${unpaid.oldestDays === 0 ? 'from today' : unpaid.oldestDays === 1 ? '1 day old' : `${unpaid.oldestDays} days old`}` : ''} />,
    )
  }
  if (openSeats.count > 0) {
    attention.push(
      <AttentionRow key="seats" href={`/admin?tab=bookings&${q}`} tone="yellow" mark="+"
        title={`${openSeats.count} invite ${openSeats.count === 1 ? 'spot' : 'spots'} still open`}
        text={openSeats.soonest ? `Soonest: ${openSeats.soonest}` : 'Games starting in the next 24 hours'} />,
    )
  }
  if (p.notOpenYet) {
    attention.unshift(
      <AttentionRow key="notopen" href={`/admin/setup?${q}`} tone="yellow" mark="!"
        title="This club isn't open for booking yet"
        text="Players see Courts coming soon. Open it when you're ready." />,
    )
  }
  // Empty court time lives on the court card below (with the Fill them button), not in this list.
  const fillButton = act?.offersOn && act.fill
    ? <FillButton venueSlug={p.venueSlug} gap={act.fill.gap} bounds={act.fill.bounds} autoOpen={act.autoOpen === 'fill'} hero />
    : null

  const noCourts = s.courts.length === 0
  const aside = (
    <>
      <div>
        <div className="text-[11px] font-extrabold uppercase mb-2 px-0.5" style={sectionLabel}>Needs attention</div>
      <div className="rounded-[20px] overflow-hidden" style={card}>
        {attention.length > 0 ? attention : (
          <div className="px-3.5 py-4 text-sm" style={{ color: 'var(--text-muted)' }}>All clear. Nothing needs your attention right now.</div>
        )}
      </div>
      </div>
      <div>
        <div className="text-[11px] font-extrabold uppercase mb-2 px-0.5" style={sectionLabel}>Next up</div>
      <div className="rounded-[20px] overflow-hidden" style={card}>
        {s.nextUp.length === 0 ? (
          <div className="px-3.5 py-4 text-sm" style={{ color: 'var(--text-muted)' }}>No more bookings today.</div>
        ) : s.nextUp.map(n => (
          <div key={n.id} className="flex items-center gap-3 px-3.5 py-3" style={{ minHeight: 60, borderBottom: '1px solid var(--border)' }}>
            <div className="w-[50px] text-[17px] font-extrabold" style={{ ...display, color: 'var(--text-primary)' }}>{n.start}</div>
            <div className="min-w-0">
              <div className="text-[13px] font-bold truncate" style={{ color: 'var(--text-primary)' }}>{n.courtName} · {n.bookerName ?? 'Booking'}</div>
              <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{n.players} {n.players === 1 ? 'player' : 'players'}</div>
            </div>
            <span className="ml-auto text-[10.5px] font-extrabold px-2.5 py-1 rounded-full whitespace-nowrap"
              style={n.unpaid > 0
                ? { background: 'var(--brand-yellow-muted)', color: 'var(--text-primary)', border: '1px solid var(--brand-yellow)' }
                : { background: 'var(--brand-primary-muted)', color: 'var(--brand-primary-text)' }}>
              {n.unpaid > 0 ? `${n.unpaid} unpaid` : 'All paid'}
            </span>
          </div>
        ))}
        {s.nextUpMore > 0 && (
          <Link href={`/admin?tab=board&${q}`} data-testid="next-up-more" className="flex items-center justify-between gap-3 px-3.5 py-3.5 text-[13px] font-extrabold" style={{ color: 'var(--brand-primary-text)' }}>
            <span>+ {s.nextUpMore} more today</span><span>See them on the Board ›</span>
          </Link>
        )}
      </div>

      <Link href={`/admin?tab=board&${q}`} className="btn-main btn-main-quiet mt-4">
        Open the full dashboard
      </Link>

      </div>
    </>
  )
  return (
    <div className="w-full flex flex-col">
      <AutoRefresh />
      {/* On a computer the page title is the first thing on the page; the club picker sits under it, and the Manager switch is in the sidebar. */}
      <div className="flex items-center justify-between gap-3 mt-4">
        <VenuePicker venues={p.venues} value={p.venueSlug} />
        {p.canSwitchView !== false && <div className="lg:hidden"><ViewSwitch mode="manager" /></div>}
      </div>

      <h1 className="order-first text-2xl font-semibold">
        {p.greeting}{p.staffName ? `, ${p.staffName}` : ''}
        {p.roleLabel && (
          <span className="ml-2.5 align-middle text-[11px] font-extrabold uppercase px-2.5 py-1 rounded-full"
            style={{ letterSpacing: '0.06em', fontFamily: 'Inter, sans-serif', ...(p.showMoney
              ? { color: 'var(--brand-primary-text)', background: 'var(--brand-primary-muted)', border: '1px solid var(--brand-primary)' }
              : { color: 'var(--text-muted)', background: 'var(--bg-raised)', border: '1px solid var(--border)' }) }}>{p.roleLabel}</span>
        )}
      </h1>
      <div className="order-first text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{p.dateLabel}</div>

      {/* Phone: one column, the courts first, then needs attention and next up. Computer: the big blue card and the two side cards in a row, the courts underneath. */}
      {noCourts ? (
        <div className="grid gap-6 mt-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:items-start">
          <div className="rounded-[20px] px-3.5 py-4 text-sm" style={{ ...card, color: 'var(--text-muted)' }}>
            This club has no courts set up yet.{p.showMoney ? <> <Link href={`/admin/setup?${q}`} style={{ color: 'var(--brand-primary-text)', fontWeight: 700 }}>Set up this club</Link>.</> : ' Ask the owner to add them.'}
          </div>
          <div className="flex flex-col gap-6">{aside}</div>
        </div>
      ) : (
        <div className="mt-6">
          <ClubMap venueSlug={p.venueSlug} date={p.map.date} day={p.courtDay} bookings={p.map.bookings} nowMinutes={p.nowMinutes} currency={p.currency} showMoney={p.showMoney}
            offersOn={!!act?.offersOn} bounds={p.map.bounds} boardHref={`/admin?tab=board&${q}`} weekdayShort={p.lastWeekLabel} bookingsToday={s.bookings.today} bookingsLastWeek={s.bookings.lastWeek}
            takings={s.revenue.today} fill={fillButton} aside={aside}
            yesterday={p.briefing ? <YesterdayStrip hero b={p.briefing.b} currency={p.currency} weekday={p.briefing.weekday} label={p.briefing.yesterdayLabel} brandNew={p.briefing.brandNew} /> : null}
            stillToPlay={s.bookings.remaining} bookedPct={p.courtDay.pct} unpaidChase={p.showMoney ? null : unpaid.count}
            courts={p.courtDay.rows.map(r => ({ id: r.id, name: r.name, row: r, today: p.map.courts.find(c => c.id === r.id)?.today ?? 0, lastWeek: p.map.courts.find(c => c.id === r.id)?.lastWeek ?? 0 }))} />
        </div>
      )}
    </div>
  )
}
