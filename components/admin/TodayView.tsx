import Link from 'next/link'
import { formatPrice, type CurrencyCode } from '@/lib/currency'
import type { TodaySummary } from '@/lib/today'
import ViewSwitch from '@/components/ui/ViewSwitch'
import { AutoRefresh, VenuePicker } from '@/components/admin/TodayControls'

const display = { fontFamily: 'var(--font-display), Manrope, sans-serif' } as const
const card = { background: 'var(--bg-surface)', border: '1px solid var(--border)' } as const
const sectionLabel = { letterSpacing: '0.14em', color: 'var(--text-subtle)' } as const

export type TodayViewProps = {
  venueSlug: string
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
  showMoney: boolean // owners see money; front desk does not
  roleLabel: string | null
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-2xl p-3" style={card}>
      <div className="text-[10.5px] font-bold" style={{ color: 'var(--text-subtle)' }}>{label}</div>
      <div className="text-[22px] leading-tight font-extrabold mt-1 truncate" style={{ ...display, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{value}</div>
      <div className="text-[10.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{note}</div>
    </div>
  )
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
  if (unpaid.count > 0) {
    attention.push(
      <AttentionRow key="unpaid" href={p.showMoney ? `/admin?tab=analytics&${q}` : `/admin?tab=bookings&${q}`} tone="red" mark="$"
        title={`${unpaid.count} unpaid ${unpaid.count === 1 ? 'share' : 'shares'}${unpaid.total !== null ? ` · ${formatPrice(unpaid.total, p.currency)}` : ''}`}
        text={unpaid.oldestDays !== null ? `Oldest is ${unpaid.oldestDays === 0 ? 'from today' : unpaid.oldestDays === 1 ? '1 day old' : `${unpaid.oldestDays} days old`}` : ''} />,
    )
  }
  if (openSeats.count > 0) {
    attention.push(
      <AttentionRow key="seats" href={`/admin?tab=bookings&${q}`} tone="yellow" mark="+"
        title={`${openSeats.count} invite ${openSeats.count === 1 ? 'spot' : 'spots'} still open`}
        text={openSeats.soonest ? `Soonest: ${openSeats.soonest}` : 'Games starting in the next 24 hours'} />,
    )
  }
  if (p.showMoney && p.emptyHoursToday > 0) {
    attention.push(
      <AttentionRow key="empty" href={`/admin?tab=analytics&${q}`} tone="blue" mark="◔"
        title={`${p.emptyHoursToday} court-${p.emptyHoursToday === 1 ? 'hour' : 'hours'} still empty today`}
        text="Between now and 22:00" />,
    )
  }

  const noCourts = s.courts.length === 0
  return (
    <div className="max-w-2xl mx-auto">
      <AutoRefresh />
      <div className="flex items-center justify-between gap-2.5">
        <VenuePicker venues={p.venues} value={p.venueSlug} />
        <ViewSwitch mode="manager" />
      </div>

      <h1 className="mt-4 text-2xl font-extrabold" style={{ ...display, letterSpacing: '-0.02em' }}>
        {p.greeting}{p.staffName ? `, ${p.staffName}` : ''}
        {p.roleLabel && (
          <span className="ml-2.5 align-middle text-[11px] font-extrabold uppercase px-2.5 py-1 rounded-full"
            style={{ letterSpacing: '0.06em', fontFamily: 'Inter, sans-serif', ...(p.showMoney
              ? { color: 'var(--brand-primary-text)', background: 'var(--brand-primary-muted)', border: '1px solid var(--brand-primary)' }
              : { color: 'var(--text-muted)', background: 'var(--bg-raised)', border: '1px solid var(--border)' }) }}>{p.roleLabel}</span>
        )}
      </h1>
      <div className="text-[13px] mt-1 pl-[15px]" style={{ color: 'var(--text-muted)' }}>{p.dateLabel}</div>

      <div className="grid grid-cols-3 gap-2.5 mt-4">
        <Stat label="Bookings" value={String(s.bookings.today)} note={`${s.bookings.remaining} still to play`} />
        <Stat label="Players" value={String(s.players.today)} note={`vs ${s.players.lastWeek} last ${p.lastWeekLabel}`} />
        {p.showMoney
          ? <Stat label="Revenue" value={formatPrice(Math.round(s.revenue.today), p.currency).replace(/\.00$/, '')} note={`vs ${formatPrice(Math.round(s.revenue.lastWeek), p.currency).replace(/\.00$/, '')}`} />
          : <Stat label="Unpaid" value={String(unpaid.count)} note={unpaid.count === 1 ? 'share to chase' : 'shares to chase'} />}
      </div>

      <div className="text-[11px] font-extrabold uppercase mt-5 mb-2 px-0.5" style={sectionLabel}>Needs attention</div>
      <div className="rounded-[18px] overflow-hidden" style={card}>
        {attention.length > 0 ? attention : (
          <div className="px-3.5 py-4 text-sm" style={{ color: 'var(--text-muted)' }}>All clear. Nothing needs your attention right now.</div>
        )}
      </div>

      <div className="text-[11px] font-extrabold uppercase mt-5 mb-2 px-0.5" style={sectionLabel}>Courts right now</div>
      {noCourts ? (
        <div className="rounded-[18px] px-3.5 py-4 text-sm" style={{ ...card, color: 'var(--text-muted)' }}>
          This club has no courts set up yet.{p.showMoney ? <> Add them in the Courts tab of the <Link href={`/admin?tab=courts&${q}`} style={{ color: 'var(--brand-primary-text)', fontWeight: 700 }}>dashboard</Link>.</> : ' Ask the owner to add them.'}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {s.courts.map(c => (
            <div key={c.id} className="rounded-[14px] px-3 py-2.5" style={card}>
              <div className="text-[12.5px] font-extrabold truncate" style={{ color: 'var(--text-primary)' }}>{c.name}</div>
              <div className="flex items-center gap-1.5 mt-1 text-[11.5px] font-bold" style={{ color: 'var(--text-primary)' }}>
                <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, display: 'inline-block', background: c.state === 'inUse' ? 'var(--brand-primary-text)' : c.state === 'blocked' ? 'var(--brand-crimson)' : 'var(--text-subtle)' }} />
                {c.state === 'inUse' ? 'In use' : c.state === 'blocked' ? 'Blocked' : 'Free'}
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {c.state === 'free' ? (c.next ? `next booking ${c.next}` : 'nothing more today') : `until ${c.until}`}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="text-[11px] font-extrabold uppercase mt-5 mb-2 px-0.5" style={sectionLabel}>Next up</div>
      <div className="rounded-[18px] overflow-hidden" style={card}>
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
      </div>

      <Link href={`/admin?tab=board&${q}`} className="flex items-center justify-center rounded-2xl mt-5 text-sm font-bold"
        style={{ minHeight: 48, background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
        Open the full dashboard
      </Link>
    </div>
  )
}
