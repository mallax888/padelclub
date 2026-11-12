'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { formatPrice, type CurrencyCode } from '@/lib/currency'
import { DISCOUNT_CHOICES, MAX_PERKS, MAX_PLANS, type Plan } from '@/lib/plan-rules'
import type { PlanStats } from '@/lib/club-plans'

const display = { fontFamily: 'var(--font-display), Manrope, sans-serif' } as const
const card = { background: 'var(--bg-surface)', border: '1px solid var(--border)' } as const
const label = { letterSpacing: '0.12em', color: 'var(--text-subtle)' } as const
const field = { minHeight: 44, background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' } as const

const NEW = '__new__'

// The owner's plan editor: this club's plans, what each costs and gives, and what a
// discount costs the club. Saving goes through /api/admin/plans, which checks it all again.
export default function MembershipPlans({ venueSlug, currency, plans, stats, examplePrice }: {
  venueSlug: string
  currency: CurrencyCode
  plans: Plan[]
  stats: PlanStats
  // A real peak court price at this club, for "what a discount costs you".
  examplePrice: number | null
}) {
  const router = useRouter()
  const first = plans.find(p => p.key === 'club') ?? plans[0]
  const [sel, setSel] = useState<string>(first?.key ?? NEW)
  const current = sel === NEW ? null : plans.find(p => p.key === sel) ?? null

  const [name, setName] = useState(current?.name ?? '')
  const [price, setPrice] = useState(current ? String(current.price) : '')
  const [discount, setDiscount] = useState<number>(current?.discountPercent ?? 10)
  const [windowDays, setWindowDays] = useState(current ? String(current.windowDays) : '21')
  const [perks, setPerks] = useState((current?.perks ?? []).join('\n'))
  const [active, setActive] = useState(current?.active ?? true)
  const [busy, setBusy] = useState(false)

  const load = (key: string) => {
    setSel(key)
    const p = key === NEW ? null : plans.find(x => x.key === key) ?? null
    setName(p?.name ?? ''); setPrice(p ? String(p.price) : ''); setDiscount(p?.discountPercent ?? 10)
    setWindowDays(p ? String(p.windowDays) : '21'); setPerks((p?.perks ?? []).join('\n')); setActive(p?.active ?? true)
  }

  const isCasual = sel === 'casual'
  const members = current ? (stats.counts[current.key] ?? 0) : 0
  const given = current ? (stats.granted[current.key] ?? 0) : 0
  const priceNum = Number(price)
  const eff = isCasual ? 0 : discount

  async function post(url: string, body: object, okText: string): Promise<boolean> {
    setBusy(true)
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data.error ?? 'Could not save.'); return false }
      toast.success(okText)
      router.refresh()
      return data.key ?? true
    } catch {
      toast.error('Could not save. Check your connection and try again.')
      return false
    } finally { setBusy(false) }
  }

  async function save() {
    const out = await post('/api/admin/plans', {
      venueSlug, key: sel === NEW ? null : sel, name, price: isCasual ? 0 : priceNum, discountPercent: eff,
      windowDays: Number(windowDays), perks: perks.split('\n').map(s => s.trim()).filter(Boolean), active: isCasual ? true : active,
    }, 'Plan saved')
    if (typeof out === 'string' && sel === NEW) setSel(out)
  }

  async function remove() {
    if (!current || !confirm(`Remove the ${current.name} plan?`)) return
    if (await post('/api/admin/plans/remove', { venueSlug, key: current.key }, 'Plan removed')) load(plans[0]?.key ?? NEW)
  }

  const canRemove = !!current && !current.builtIn && members === 0

  return (
    <div className="rounded-2xl mt-3.5 px-3.5 py-3.5" style={card} data-testid="membership-plans">
      <div className="text-[15px] font-extrabold" style={{ color: 'var(--text-primary)' }}>🏅 Memberships</div>
      <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>The plans your players can join at your club. You set the price and what each plan includes.</div>

      <div className="grid grid-cols-3 gap-2 mt-3.5">
        {[
          { n: String(stats.paidMembers), t: 'on a paid plan' },
          { n: formatPrice(stats.income, currency), t: 'plan income a month' },
          { n: formatPrice(stats.givenAway, currency), t: 'given away in discounts, 30 days' },
        ].map(s => (
          <div key={s.t} className="rounded-xl px-2.5 py-2" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
            <div className="text-[15px] font-extrabold" style={{ ...display, color: 'var(--text-primary)' }}>{s.n}</div>
            <div className="text-[10.5px] leading-snug mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.t}</div>
          </div>
        ))}
      </div>

      <div className="mt-3.5 space-y-2">
        {plans.map(p => (
          <button key={p.key} type="button" onClick={() => load(p.key)} data-testid={`plan-${p.key}`}
            className="w-full text-left rounded-xl px-3 py-2.5"
            style={{ background: 'var(--bg-surface)', border: sel === p.key ? '1px solid var(--brand-primary)' : '1px solid var(--border)', opacity: p.active ? 1 : 0.6 }}>
            <span className="flex items-center justify-between gap-2">
              <span className="text-[13.5px] font-extrabold" style={{ color: 'var(--text-primary)' }}>
                {p.name}
                <span className="ml-2 text-[10px] font-bold rounded-full px-2 py-0.5" style={{ background: 'var(--bg-raised)', color: p.active ? 'var(--brand-green)' : 'var(--text-muted)' }}>{p.key === 'casual' ? 'Always on' : p.active ? 'On' : 'Off'}</span>
              </span>
              <span className="text-[13.5px] font-extrabold" style={{ color: 'var(--text-primary)' }}>{p.price === 0 ? 'Free' : `${formatPrice(p.price, currency)} / month`}</span>
            </span>
            <span className="block text-[11.5px] mt-1" style={{ color: 'var(--text-muted)' }}>
              {p.discountPercent > 0 ? `${p.discountPercent}% off` : 'No discount'} · book {p.windowDays} days ahead · {stats.counts[p.key] ?? 0} {(stats.counts[p.key] ?? 0) === 1 ? 'member' : 'members'}
            </span>
          </button>
        ))}
        {plans.length < MAX_PLANS && (
          <button type="button" onClick={() => load(NEW)} data-testid="plan-add"
            className="w-full rounded-xl py-2.5 text-[13px] font-bold" style={{ border: '1.5px dashed var(--text-subtle)', color: 'var(--text-muted)', background: 'transparent' }}>+ Add a plan</button>
        )}
      </div>

      <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }} data-testid="plan-editor">
        <div className="text-[15px] font-extrabold" style={{ ...display, color: 'var(--text-primary)' }}>{current ? `Edit ${current.name}` : 'New plan'}</div>

        <label htmlFor="plan-name" className="block text-[11px] font-extrabold uppercase mt-3 mb-1.5" style={label}>Plan name</label>
        <input id="plan-name" value={name} onChange={e => setName(e.target.value.slice(0, 40))} className="w-full rounded-xl px-3 text-sm font-semibold" style={field} />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="plan-price" className="block text-[11px] font-extrabold uppercase mt-3 mb-1.5" style={label}>Price a month</label>
            <input id="plan-price" inputMode="numeric" value={isCasual ? '0' : price} disabled={isCasual} onChange={e => setPrice(e.target.value.replace(/[^0-9]/g, '').slice(0, 5))}
              className="w-full rounded-xl px-3 text-sm font-semibold disabled:opacity-60" style={field} />
          </div>
          <div>
            <label htmlFor="plan-window" className="block text-[11px] font-extrabold uppercase mt-3 mb-1.5" style={label}>Book up to (days)</label>
            <input id="plan-window" inputMode="numeric" value={windowDays} onChange={e => setWindowDays(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
              className="w-full rounded-xl px-3 text-sm font-semibold" style={field} />
          </div>
        </div>

        <div className="text-[11px] font-extrabold uppercase mt-3 mb-1.5" style={label}>Discount on court bookings</div>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Discount">
          {DISCOUNT_CHOICES.map(d => (
            <button key={d} type="button" role="radio" aria-checked={eff === d} disabled={isCasual && d !== 0} onClick={() => setDiscount(d)}
              className="rounded-full px-3.5 py-2 text-[12.5px] font-extrabold disabled:opacity-40"
              style={eff === d ? { background: 'var(--brand-primary-muted)', border: '1px solid var(--brand-primary)', color: 'var(--brand-primary-text)' } : { background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              {d === 0 ? 'None' : `${d}%`}
            </button>
          ))}
        </div>

        <label htmlFor="plan-perks" className="block text-[11px] font-extrabold uppercase mt-3 mb-1.5" style={label}>Extra perks you promise (one per line, up to {MAX_PERKS})</label>
        <textarea id="plan-perks" rows={3} value={perks} onChange={e => setPerks(e.target.value)} placeholder="e.g. Free towel hire"
          className="w-full rounded-xl px-3 py-2.5 text-[13px] leading-relaxed" style={{ ...field, minHeight: 0, resize: 'none' }} />
        <p className="text-[11px] mt-1" style={{ color: 'var(--text-subtle)' }}>Players always see the discount and days ahead. Anything you write here is shown too, and delivering it is up to you.</p>

        {examplePrice !== null && (
          <div className="rounded-xl px-3 py-2.5 mt-3.5 text-[12.5px] leading-relaxed" data-testid="plan-effect" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            A member books a <b style={{ color: 'var(--text-primary)' }}>{formatPrice(examplePrice, currency)}</b> peak court and pays <b style={{ color: 'var(--text-primary)' }}>{formatPrice(Math.round(examplePrice * (1 - eff / 100)), currency)}</b>.
            {eff > 0 && <> You give up <b style={{ color: 'var(--text-primary)' }}>{formatPrice(examplePrice - Math.round(examplePrice * (1 - eff / 100)), currency)}</b> a booking.</>}
            {!isCasual && priceNum > 0 && <> The plan brings in <b style={{ color: 'var(--text-primary)' }}>{formatPrice(priceNum, currency)}</b> a month.</>}
          </div>
        )}

        {!isCasual && (
          <div className="flex items-center justify-between gap-3 mt-3.5 pt-3.5" style={{ borderTop: '1px solid var(--border)' }}>
            <span className="min-w-0">
              <span className="block text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>Offer this plan</span>
              <span className="block text-[11.5px]" style={{ color: 'var(--text-subtle)' }}>Switch off to stop new sign-ups. Current members keep it.</span>
            </span>
            <button type="button" role="switch" aria-checked={active} aria-label="Offer this plan" onClick={() => setActive(a => !a)}
              className="shrink-0 relative rounded-full" style={{ width: 46, height: 26, background: active ? 'var(--brand-primary)' : 'var(--bg-raised)', border: active ? 'none' : '1px solid var(--border)' }}>
              <span style={{ position: 'absolute', top: 3, left: active ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: active ? '#fff' : 'var(--text-subtle)', transition: 'left 0.15s' }} />
            </button>
          </div>
        )}
        {given > 0 && <p className="text-[11.5px] mt-2" style={{ color: 'var(--text-subtle)' }}>{given} {given === 1 ? 'member has' : 'members have'} this plan free, given by you.</p>}

        <div className="flex gap-2 mt-4">
          <button type="button" onClick={save} disabled={busy} className="flex-1 rounded-xl text-sm font-extrabold disabled:opacity-50" style={{ minHeight: 46, background: 'var(--brand-primary)', color: 'var(--brand-primary-on)' }}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
          {canRemove && (
            <button type="button" onClick={remove} disabled={busy} className="rounded-xl px-4 text-sm font-bold disabled:opacity-50" style={{ minHeight: 46, background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--brand-crimson)' }}>Remove</button>
          )}
        </div>
        <p className="text-[11.5px] mt-3 leading-relaxed" style={{ color: 'var(--text-subtle)' }}>
          A plan is a one-month pass that members buy again each month. A new price applies to the next purchase, never to a month already paid. Switching a plan off never cancels anyone. Plans work at your club only; at other clubs your members pay the normal court price.
        </p>
      </div>
    </div>
  )
}
