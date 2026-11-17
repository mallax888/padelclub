'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { formatPrice, type CurrencyCode } from '@/lib/currency'
import MembershipPlans from '@/components/admin/MembershipPlans'
import ClubPayouts from '@/components/admin/ClubPayouts'
import BriefingSettings from '@/components/admin/BriefingSettings'
import type { BriefingSettings as BriefingSettingsValue } from '@/lib/briefing'
import type { Plan } from '@/lib/plan-rules'
import type { PlanStats } from '@/lib/club-plans'
import { DAY_KEYS, DAY_NAMES, TIME_CHOICES, defaultWeek, describeWeek, fromMinutes, toMinutes, type DayKey, type WeekHours } from '@/lib/venue-hours'

const display = { fontFamily: 'var(--font-display), Manrope, sans-serif' } as const
const card = { background: 'var(--bg-surface)', border: '1px solid var(--border)' } as const
const sectionLabel = { letterSpacing: '0.14em', color: 'var(--text-subtle)' } as const

export type SetupClub = { slug: string; name: string; region: string; status: 'new' | 'ready' | 'live' }
type CourtRow = { id: string; name: string; type: string; pricePerHour: number; pricePerHourPeak: number | null }
type Listed = { name: string; type: string; isIndoor: boolean }
type Step = 'home' | 'hours' | 'courts' | 'live'

const STATUS_TEXT: Record<SetupClub['status'], string> = { new: 'New', ready: 'Not open', live: 'Open' }

async function post(url: string, body: object): Promise<string | null> {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({}))
    return res.ok ? null : (data.error ?? 'Could not save.')
  } catch {
    return 'Could not save. Check your connection and try again.'
  }
}

function Progress({ done }: { done: number }) {
  return (
    <div className="flex gap-1.5 mt-4" aria-hidden>
      {[1, 2, 3].map(i => <i key={i} style={{ flex: 1, height: 4, borderRadius: 4, background: i <= done ? 'var(--brand-primary)' : 'var(--bg-raised)' }} />)}
    </div>
  )
}

const Primary = ({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) => (
  <button type="button" onClick={onClick} disabled={disabled}
    className="btn-main mt-4">{children}</button>
)
const Ghost = ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
  <button type="button" onClick={onClick} className="btn-main btn-main-quiet mt-4">{children}</button>
)

function Switch({ on, onClick, label, disabled }: { on: boolean; onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick} disabled={disabled}
      className="shrink-0 relative rounded-full disabled:opacity-60"
      style={{ width: 46, height: 26, background: on ? 'var(--brand-primary)' : 'var(--bg-raised)', border: on ? 'none' : '1px solid var(--border)' }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: on ? '#fff' : 'var(--text-subtle)', transition: 'left 120ms' }} />
    </button>
  )
}

export default function ClubSetup({ clubs, venue, listed, currency, hours: savedHours, isOpen, courts, regulars, memberships = null, stripeReturn = null, briefing = null }: {
  clubs: SetupClub[]
  venue: { slug: string; name: string; address: string; region: string }
  listed: Listed[]
  currency: CurrencyCode
  hours: WeekHours | null
  isOpen: boolean
  courts: CourtRow[]
  // This club's rules for weekly regulars. Null when the regulars database change hasn't been run.
  regulars: { enabled: boolean; peakCap: number | null } | null
  // This club's membership plans and figures. Null when the club plans database change hasn't been run.
  memberships?: { plans: Plan[]; stats: PlanStats; examplePrice: number | null } | null
  // Set when the owner has just come back from Stripe's form.
  stripeReturn?: 'return' | 'refresh' | null
  // This club's morning briefing settings. Null when the 035 database change hasn't been run.
  briefing?: BriefingSettingsValue | null
  // Where this club is on the map for "clubs near me". Null when the 031 database change hasn't been run.
}) {
  const router = useRouter()
  const [step, setStep] = useState<Step>(stripeReturn ? 'live' : 'home')
  const [busy, setBusy] = useState(false)
  const [capText, setCapText] = useState(regulars?.peakCap != null ? String(regulars.peakCap) : '')
  const [week, setWeek] = useState<WeekHours>(savedHours ?? defaultWeek())
  const [price, setPrice] = useState(courts[0] ? String(courts[0].pricePerHour) : '')
  const [peak, setPeak] = useState(courts[0]?.pricePerHourPeak != null ? String(courts[0].pricePerHourPeak) : '')

  const hoursDone = savedHours !== null
  const courtsDone = courts.length > 0
  const liveDone = courtsDone && isOpen
  const doneCount = 1 + (hoursDone ? 1 : 0) + (courtsDone ? 1 : 0) + (liveDone ? 1 : 0)
  const symbol = formatPrice(0, currency).replace(/[0-9.,\s ]/g, '')
  const have = new Set(courts.map(c => c.name.toLowerCase()))
  const toAdd = listed.filter(c => !have.has(c.name.toLowerCase()))

  const run = async (url: string, body: object, ok: string): Promise<boolean> => {
    setBusy(true)
    const error = await post(url, body)
    setBusy(false)
    if (error) { toast.error(error); return false }
    toast.success(ok)
    router.refresh()
    return true
  }

  const setDay = (d: DayKey, v: WeekHours[DayKey]) => setWeek(w => ({ ...w, [d]: v }))
  const setOpenTime = (d: DayKey, open: string) => {
    const cur = week[d]!
    const close = toMinutes(cur.close) <= toMinutes(open) ? fromMinutes(Math.min(toMinutes(open) + 60, 24 * 60)) : cur.close
    setDay(d, { open, close })
  }
  const copyMonday = () => setWeek(w => ({ ...w, tue: w.mon, wed: w.mon, thu: w.mon, fri: w.mon }))

  const numberOk = (s: string) => Number.isFinite(Number(s)) && Number(s) > 0
  const addCourts = async (list: { name: string; type: string; isIndoor: boolean }[]) => {
    if (!numberOk(price)) { toast.error('Enter a price per hour first.'); return }
    if (peak !== '' && !numberOk(peak)) { toast.error('Check the peak price.'); return }
    await run('/api/admin/courts', {
      venueSlug: venue.slug,
      courts: list.map(c => ({ ...c, pricePerHour: Number(price), pricePerHourPeak: peak === '' ? null : Number(peak) })),
    }, list.length === 1 ? 'Court added' : `${list.length} courts added`)
  }
  const addAnother = () => {
    let n = courts.length + 1
    while (have.has(`court ${n}`)) n++
    return addCourts([{ name: `Court ${n}`, type: courts[courts.length - 1]?.type ?? listed[0]?.type ?? 'Doubles', isIndoor: listed[0]?.isIndoor ?? true }])
  }


  const Header = ({ back }: { back?: boolean }) => (
    <>
      <div className="flex items-center justify-between gap-3 mt-4">
        {back
          ? <button type="button" onClick={() => setStep('home')} className="inline-flex items-center text-[13px] font-bold" style={{ minHeight: 40, color: 'var(--brand-primary-text)' }}>‹ Setup</button>
          : <span aria-hidden />}
        <label className="relative inline-flex items-center min-w-0">
          <span className="sr-only">Club</span>
          <select value={venue.slug} onChange={e => router.push(`/admin/setup?venue=${encodeURIComponent(e.target.value)}`)}
            className="rounded-full pl-3.5 pr-8 text-[12.5px] font-bold min-w-0 max-w-[230px] appearance-none"
            style={{ minHeight: 40, background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
            {clubs.map(c => <option key={c.slug} value={c.slug}>{c.name} · {STATUS_TEXT[c.status]}</option>)}
          </select>
          <span aria-hidden className="pointer-events-none absolute right-3 text-xs" style={{ color: 'var(--text-subtle)' }}>▾</span>
        </label>
      </div>
      <Progress done={doneCount - 1} />
    </>
  )

  // ------------------------------------------------------------- the prompt flow
  // One question at a time, read straight down. Answered questions fold into a one-line card with a
  // Change link; the open question sits under them; what is still to come is shown dimmed. Once the
  // club is set up, the page is simply its answers plus its settings, stacked.
  const selectStyle = { minHeight: 40, background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' } as const
  const inputStyle = { minHeight: 46, background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' } as const
  const first = courts[0]
  const next: Step = !hoursDone ? 'hours' : !courtsDone ? 'courts' : 'live'
  const eff: Step = step === 'home' ? next : step
  type Q = 'hours' | 'courts' | 'live'
  const order: Q[] = ['hours', 'courts', 'live']
  const qLabel: Record<Q, string> = { hours: 'What are your opening hours?', courts: 'Courts and prices', live: isOpen ? 'Open for booking' : 'Ready to open?' }
  const hoursText = hoursDone ? describeWeek(savedHours).join(' · ') : ''
  const courtsText = courtsDone ? `${courts.length} ${courts.length === 1 ? 'court' : 'courts'}${first ? ` · ${formatPrice(first.pricePerHour, currency)}/hr${first.pricePerHourPeak != null ? ` · ${formatPrice(first.pricePerHourPeak, currency)} peak` : ''}` : ''}` : ''
  const answered = (key: string, label: string, value: React.ReactNode, onChange?: () => void) => (
    <div key={key} className="flex items-center gap-3.5 rounded-[20px] px-4 py-3.5" data-testid={`answered-${key}`} style={{ ...card }}>
      <span className="flex items-center justify-center rounded-full shrink-0 text-[13px] font-extrabold" style={{ width: 26, height: 26, background: 'var(--brand-primary-muted)', color: 'var(--brand-primary-text)' }} aria-hidden>✓</span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-extrabold uppercase" style={{ letterSpacing: '0.1em', color: 'var(--text-subtle)' }}>{label}</div>
        <div className="text-[15px] font-bold sm:truncate" style={{ color: 'var(--text-primary)' }}>{value}</div>
      </div>
      {onChange && <button type="button" onClick={onChange} className="text-[13px] font-bold shrink-0" style={{ color: 'var(--link-change)' }} aria-label={`Change ${label}`}>Change</button>}
    </div>
  )
  const ask = (title: string, subtitle: string | undefined, children: React.ReactNode) => (
    <div className="rounded-[20px] p-5 sm:p-6" data-testid="open-question" style={{ ...card, border: '1.5px solid var(--brand-primary)', boxShadow: '0 0 0 4px var(--brand-primary-muted)' }}>
      <div className="text-[11px] font-extrabold uppercase" style={{ letterSpacing: '0.1em', color: 'var(--brand-primary-text)' }}>Question {order.indexOf(eff) + 1} of {order.length}</div>
      <h2 className="text-xl font-extrabold mt-0.5" style={{ color: 'var(--text-primary)' }}>{title}</h2>
      {subtitle && <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>}
      <div className="flex flex-col [&>*:first-child]:mt-4">{children}</div>
    </div>
  )
  const stack = 'flex flex-col gap-4 [&>*]:mt-0'

  return (
    <div className="w-full flex flex-col">
      <Header />
      <h1 className="order-first text-2xl font-semibold leading-tight">
        {liveDone ? `${venue.name} is open for booking` : `Get ${venue.name} ready for bookings`}
      </h1>
      <p className="order-first text-sm mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        {liveDone ? 'Change any of it below, any time.' : "A few quick questions and players can book courts. You can change any of it later."}
      </p>
      <div className={`${stack} mt-4`}>
        {answered('club', 'Your club', <>{venue.name} · {venue.address}</>)}
        {hoursDone && eff !== 'hours' && answered('hours', 'Opening hours', hoursText, () => setStep('hours'))}
        {courtsDone && eff !== 'courts' && answered('courts', 'Courts and prices', courtsText, () => setStep('courts'))}

        {eff === 'hours' && ask(qLabel.hours, "The hours players can book. Times outside them aren't offered.", <>
        <div className="rounded-[20px] overflow-hidden mt-4" style={card}>
            {DAY_KEYS.map(d => {
              const h = week[d]
              return (
                <div key={d} className="flex items-center gap-2 px-3.5 py-2.5" style={{ minHeight: 58, borderBottom: '1px solid var(--border)' }}>
                  <span className="w-10 text-[13px] font-extrabold shrink-0" style={{ color: 'var(--text-primary)' }}>{DAY_NAMES[d]}</span>
                  {h ? (
                    <>
                      <select aria-label={`${DAY_NAMES[d]} opens`} value={h.open} onChange={e => setOpenTime(d, e.target.value)} className="rounded-[10px] px-2 text-[13.5px] font-bold" style={selectStyle}>
                        {TIME_CHOICES.filter(t => t !== '24:00').map(t => <option key={t}>{t}</option>)}
                      </select>
                      <span aria-hidden style={{ color: 'var(--text-subtle)' }}>–</span>
                      <select aria-label={`${DAY_NAMES[d]} closes`} value={h.close} onChange={e => setDay(d, { open: h.open, close: e.target.value })} className="rounded-[10px] px-2 text-[13.5px] font-bold" style={selectStyle}>
                        {TIME_CHOICES.filter(t => toMinutes(t) > toMinutes(h.open)).map(t => <option key={t}>{t}</option>)}
                      </select>
                    </>
                  ) : <span className="text-[12.5px] font-semibold" style={{ color: 'var(--text-subtle)' }}>Closed</span>}
                  <span className="ml-auto"><Switch on={!!h} label={`${DAY_NAMES[d]} open`} onClick={() => setDay(d, h ? null : { open: '07:00', close: '22:00' })} /></span>
                </div>
              )
            })}
          </div>
          {week.mon && <Ghost onClick={copyMonday}>Copy Monday to all weekdays</Ghost>}
          <Primary disabled={busy} onClick={async () => { if (await run('/api/admin/venue-settings', { venueSlug: venue.slug, hours: week }, 'Opening hours saved')) setStep('courts') }}>
            {busy ? 'Saving…' : 'Save and continue'}
          </Primary>
        </>)}

        {eff === 'courts' && ask(qLabel.courts, listed.length > 0 ? `${venue.name} lists ${listed.length} ${listed.length === 1 ? 'court' : 'courts'}. Add ${listed.length === 1 ? 'it' : 'them'} in one go, then set the prices.` : 'Set the price, then add your courts.', <>
        <div className="flex gap-2.5 mt-4">
          {([['Price per hour', price, setPrice, '48'], ['Peak price', peak, setPeak, 'same']] as const).map(([label, val, set, ph]) => (
            <label key={label} className="flex-1 block">
              <span className="block text-[11px] font-extrabold uppercase mb-1.5" style={sectionLabel}>{label}</span>
              <span className="flex items-center gap-1.5 rounded-xl px-3.5" style={inputStyle}>
                <span style={{ color: 'var(--text-subtle)' }}>{symbol}</span>
                <input inputMode="decimal" value={val} onChange={e => set(e.target.value.replace(/[^0-9.]/g, ''))} placeholder={ph}
                  className="w-full bg-transparent text-[15px] font-bold outline-none" style={{ color: 'var(--text-primary)' }} aria-label={label} />
              </span>
            </label>
          ))}
        </div>
        <p className="text-[11.5px] mt-2 leading-relaxed" style={{ color: 'var(--text-subtle)' }}>Peak is weekends and 5&ndash;9pm. Leave the peak price empty to charge the normal price all week.</p>
        {toAdd.length > 0 && (
          <Primary disabled={busy} onClick={() => addCourts(toAdd)}>
            {busy ? 'Adding…' : courts.length === 0 ? `Add all ${toAdd.length} ${toAdd.length === 1 ? 'court' : 'courts'}` : `Add the other ${toAdd.length} listed ${toAdd.length === 1 ? 'court' : 'courts'}`}
          </Primary>
        )}
        {courts.length > 0 && (
          <>
            <div className="text-[11px] font-extrabold uppercase mt-5 mb-2 px-0.5" style={sectionLabel}>Courts added</div>
            <div className="rounded-[20px] overflow-hidden" style={card}>
              {courts.map(c => (
                <Link key={c.id} href={`/admin?tab=courts&venue=${encodeURIComponent(venue.slug)}`} className="flex items-center gap-3 px-3.5 py-3" style={{ minHeight: 64, borderBottom: '1px solid var(--border)' }}>
                  <span className="min-w-0"><span className="block text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{c.name}</span><span className="block text-[11.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{c.type}</span></span>
                  <span className="ml-auto text-right text-[13px] font-extrabold" style={{ color: 'var(--text-primary)' }}>{formatPrice(c.pricePerHour, currency)}/hr
                    {c.pricePerHourPeak != null && <span className="block text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>{formatPrice(c.pricePerHourPeak, currency)} peak</span>}</span>
                  <span aria-hidden className="text-lg" style={{ color: 'var(--text-subtle)' }}>›</span>
                </Link>
              ))}
            </div>
            <p className="text-[11.5px] mt-2 px-1" style={{ color: 'var(--text-subtle)' }}>Tap a court to rename it or change its price.</p>
          </>
        )}
        <Ghost onClick={() => { void addAnother() }}>+ Add another court</Ghost>
        <Primary disabled={courts.length === 0} onClick={() => setStep('home')}>Continue</Primary>
        </>)}

        {eff === 'live' && <>
          {ask(qLabel.live, 'Check it over. You can change any of this later.', <>
      <div className="rounded-[20px] overflow-hidden mt-4" style={card}>
        {[
          ['Club', venue.name],
          ['Hours', hoursDone ? describeWeek(savedHours).join('\n') : 'Not set (07:00–22:00)'],
          ['Courts', courts.length > 0 ? `${courts.length} ${courts.length === 1 ? 'court' : 'courts'}` : 'None yet'],
          ['Prices', first ? `${formatPrice(first.pricePerHour, currency)}/hr${first.pricePerHourPeak != null ? ` · ${formatPrice(first.pricePerHourPeak, currency)} peak` : ''}` : '—'],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 px-3.5 py-3 text-[13px]" style={{ borderBottom: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--text-muted)' }}>{k}</span>
            <span className="font-bold text-right whitespace-pre-line" style={{ color: 'var(--text-primary)' }}>{v}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 rounded-2xl mt-4 px-3.5 py-3.5" style={{ ...card, border: '1px solid var(--brand-primary)', minHeight: 72 }}>
        <span className="min-w-0">
          <span className="block text-[15px] font-extrabold" style={{ color: 'var(--text-primary)' }}>Open for booking</span>
          <span className="block text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{isOpen ? 'Players can see and book your courts' : 'Players see "Courts coming soon" until you switch this on'}</span>
        </span>
        <span className="ml-auto">
          <Switch on={isOpen} label="Open for booking" disabled={busy || courts.length === 0}
            onClick={() => { void run('/api/admin/venue-settings', { venueSlug: venue.slug, isOpen: !isOpen }, !isOpen ? `${venue.name} is open for booking` : 'Closed to players') }} />
        </span>
      </div>

          </>)}
        </>}


        {eff !== 'live' && <div className="text-[11px] font-extrabold uppercase mt-2 px-0.5" style={sectionLabel}>More settings</div>}
      {regulars && (
        <div className="rounded-2xl mt-4 p-5" style={card} data-testid="regulars-rules">
          <div className="flex items-center gap-3">
            <span className="min-w-0">
              <span className="block text-[15px] font-extrabold" style={{ color: 'var(--text-primary)' }}>🔁 Weekly regulars</span>
              <span className="block text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{regulars.enabled ? 'Players can book the same time every week' : 'Players can only book one court at a time'}</span>
            </span>
            <span className="ml-auto">
              <Switch on={regulars.enabled} label="Weekly regulars" disabled={busy}
                onClick={() => { void run('/api/admin/regulars-settings', { venueSlug: venue.slug, enabled: !regulars.enabled }, !regulars.enabled ? 'Regulars are on' : 'Regulars are off') }} />
            </span>
          </div>
          {regulars.enabled && (
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
              <label className="block text-xs font-bold" htmlFor="regular-cap" style={{ color: 'var(--text-muted)' }}>Most courts regulars can hold at one peak time</label>
              <div className="flex gap-2 mt-2">
                <input id="regular-cap" inputMode="numeric" value={capText} onChange={e => setCapText(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))} placeholder="No limit"
                  className="flex-1 rounded-xl px-3 text-sm" style={{ minHeight: 44, background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                <button type="button" disabled={busy} className="rounded-xl px-4 text-sm font-bold disabled:opacity-50" style={{ minHeight: 44, background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  onClick={() => { void run('/api/admin/regulars-settings', { venueSlug: venue.slug, peakCap: capText === '' ? null : Number(capText) }, capText === '' ? 'No limit on regulars at peak' : `Regulars can hold up to ${capText} ${capText === '1' ? 'court' : 'courts'} at peak`) }}>
                  Save
                </button>
              </div>
              <p className="text-[11px] mt-2 leading-relaxed" style={{ color: 'var(--text-subtle)' }}>Peak is weekday evenings (5 to 9pm) and weekends. Leave it blank for no limit, so regulars could hold every court. Walk-ins always have what is left.</p>
            </div>
          )}
        </div>
      )}
          <BriefingSettings venueSlug={venue.slug} settings={briefing} />
          <ClubPayouts venueSlug={venue.slug} returning={stripeReturn} />
          {memberships && <MembershipPlans venueSlug={venue.slug} currency={currency} plans={memberships.plans} stats={memberships.stats} examplePrice={memberships.examplePrice} />}

        {eff === 'live' && <>
          <Primary onClick={() => router.push(isOpen ? `/admin/today?venue=${encodeURIComponent(venue.slug)}` : '/admin/setup?venue=' + encodeURIComponent(venue.slug))}>
            {isOpen ? 'Done' : 'Save for later'}
          </Primary>
          <p className="text-xs rounded-2xl px-3.5 py-3 leading-relaxed" style={{ background: 'var(--brand-primary-muted)', border: '1px solid var(--brand-primary)', color: 'var(--text-muted)' }}>
            Bookings show on your Today screen as soon as the first one comes in.
          </p>
        </>}

      </div>
    </div>
  )
}
