'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { formatPrice, type CurrencyCode } from '@/lib/currency'

const card = { background: 'var(--bg-surface)', border: '1px solid var(--border)' } as const
const muted = { color: 'var(--text-muted)' } as const

type Money = { availableCents: number; pendingCents: number; onItsWayCents: number; nextPayoutDate: number | null; recent: { id: string; amountCents: number; date: number; status: string }[] }
type Status = {
  on: boolean; supported: boolean; country: string | null; currency: CurrencyCode
  state: 'not_started' | 'needs_info' | 'checking' | 'ready'
  due: string[]; fee: { percent: number; fixed: number }; live?: boolean; money?: Money
}

const day = (unix: number) => new Date(unix * 1000).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', timeZone: 'UTC' })

// "Get paid directly": the club connects its own Stripe account from here, then sees how
// payouts are going. Everything about the account itself lives with Stripe.
export default function ClubPayouts({ venueSlug, returning }: { venueSlug: string; returning: 'return' | 'refresh' | null }) {
  const [s, setS] = useState<Status | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/club/payouts?venueSlug=${encodeURIComponent(venueSlug)}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('bad')
      setS(await res.json()); setFailed(false)
    } catch { setFailed(true) }
  }, [venueSlug])
  useEffect(() => { void load() }, [load])
  useEffect(() => { if (returning === 'return') toast('Welcome back. Checking with Stripe…', { icon: '🔄' }) }, [returning])

  const connect = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/club/payouts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ venueSlug }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.url) { toast.error((data.error ?? 'Could not start Stripe. Please try again.') + (data.detail ? ` [${data.detail}]` : ''), { duration: 12000 }); setBusy(false); return }
      window.location.href = data.url
    } catch { toast.error('Could not reach Stripe. Check your connection and try again.'); setBusy(false) }
  }

  const shell = (children: React.ReactNode, pill?: { text: string; tone: 'ok' | 'warn' | 'mute' }) => (
    <div className="rounded-2xl mt-3.5 px-3.5 py-3.5" style={card} data-testid="club-payouts">
      <div className="flex items-center gap-3">
        <span className="text-[15px] font-extrabold" style={{ color: 'var(--text-primary)' }}>💳 Get paid directly</span>
        {pill && (
          <span data-testid="payouts-pill" className="ml-auto text-[11px] font-extrabold rounded-full px-2.5 py-1"
            style={{ background: pill.tone === 'ok' ? 'var(--success-muted, rgba(53,194,122,.16))' : pill.tone === 'warn' ? 'rgba(240,169,59,.16)' : 'var(--bg-raised)', color: pill.tone === 'ok' ? 'var(--success, #35c27a)' : pill.tone === 'warn' ? '#f0a93b' : 'var(--text-muted)' }}>{pill.text}</span>
        )}
      </div>
      {children}
    </div>
  )
  const Btn = ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
    <button type="button" disabled={busy} onClick={onClick} data-testid="connect-stripe"
      className="flex items-center justify-center w-full rounded-2xl mt-3 text-[15px] font-extrabold disabled:opacity-50"
      style={{ minHeight: 48, background: 'var(--brand-primary)', color: 'var(--brand-primary-on)' }}>{busy ? 'Opening Stripe…' : children}</button>
  )

  if (failed && !s) return shell(<p className="text-xs mt-2" style={muted}>We couldn&apos;t load your payout details just now. Refresh the page to try again.</p>)
  if (!s) return shell(<p className="text-xs mt-2" style={muted}>Loading…</p>)

  const price = (cents: number) => formatPrice(cents / 100, s.currency)

  if (!s.supported) return shell(<p className="text-xs mt-2 leading-relaxed" style={muted}>Direct payouts aren&apos;t available for clubs in {s.country ?? 'your country'} yet. Players pay exactly as they do today, and we&apos;ll tell you the moment it is.</p>, { text: 'Not available yet', tone: 'mute' })
  if (!s.on) return shell(<p className="text-xs mt-2 leading-relaxed" style={muted}>Players&apos; card payments will go straight into your club&apos;s own Stripe account. This isn&apos;t switched on for PadelClub yet. We&apos;ll tell you when you can connect.</p>, { text: 'Coming soon', tone: 'mute' })

  if (s.state === 'not_started') return shell(
    <>
      <ul className="mt-2.5 text-[13px] leading-relaxed list-disc pl-5" style={muted}>
        <li>Players&apos; payments go straight to your club&apos;s own Stripe account</li>
        <li>Paid out to your bank automatically, no waiting on us</li>
        <li>Takes about 5 minutes: business details and a bank account</li>
        <li>Bookings stay open to players while you set it up</li>
      </ul>
      <Btn onClick={connect}>Connect with Stripe →</Btn>
      <p className="text-[11px] mt-2 text-center" style={{ color: 'var(--text-subtle)' }}>Opens Stripe&apos;s short form, then brings you back here. PadelClub never sees your bank details.</p>
    </>, { text: 'Not connected', tone: 'warn' })

  if (s.state === 'needs_info') return shell(
    <>
      <p className="text-[13px] mt-2.5" style={muted}>{returning === 'refresh' ? 'That Stripe page timed out. ' : ''}Stripe still needs a few things before it can pay you:</p>
      <ul className="mt-2 text-[13px] leading-relaxed list-disc pl-5" style={{ color: 'var(--text-primary)' }} data-testid="due-list">
        {(s.due.length ? s.due : ['Your business details and bank account']).map(d => <li key={d}>{d}</li>)}
      </ul>
      <p className="text-[12px] mt-2 leading-relaxed" style={{ color: 'var(--text-subtle)' }}>Until this is done, card payments for your club still work and go to PadelClub&apos;s account as before.</p>
      <Btn onClick={connect}>Continue on Stripe →</Btn>
    </>, { text: 'Action needed', tone: 'warn' })

  if (s.state === 'checking') return shell(
    <>
      <p className="text-[13px] mt-2.5 leading-relaxed" style={muted}>You&apos;re all done on your side. Stripe is checking your details, which usually takes a few minutes, occasionally a day.</p>
      <button type="button" onClick={() => void load()} className="flex items-center justify-center w-full rounded-2xl mt-3 text-sm font-bold" style={{ minHeight: 44, background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>Check again</button>
    </>, { text: 'Stripe is checking', tone: 'warn' })

  const m = s.money
  return shell(
    <div data-testid="payouts-ready">
      {m ? (
        <>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {[
              ['On its way to your bank', price(m.onItsWayCents + m.pendingCents)],
              ['Next payout', m.nextPayoutDate ? day(m.nextPayoutDate) : '—'],
              ['Ready to pay out', price(m.availableCents)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl px-2.5 py-2" style={{ background: 'var(--bg-raised)' }}>
                <div className="text-[10.5px]" style={muted}>{k}</div>
                <div className="text-[15px] font-extrabold mt-0.5 tabular-nums" style={{ color: 'var(--text-primary)' }}>{v}</div>
              </div>
            ))}
          </div>
          {m.recent.length > 0 && (
            <div className="mt-3 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              {m.recent.map(p => (
                <div key={p.id} className="flex justify-between gap-3 px-3 py-2 text-[13px]" style={{ borderBottom: '1px solid var(--border)' }}>
                  <span style={muted}>{day(p.date)} · {p.status === 'paid' ? 'Paid' : p.status === 'failed' ? 'Failed' : 'On its way'}</span>
                  <span className="font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{price(p.amountCents)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : <p className="text-[13px] mt-2.5" style={muted}>Your club is paid directly. Your balance couldn&apos;t be loaded just now.</p>}
      <p className="text-[12px] mt-3 leading-relaxed" style={{ color: 'var(--text-subtle)' }} data-testid="fee-line">
        Players&apos; payments go straight to your Stripe account. PadelClub&apos;s fee is {s.fee.percent}%{s.fee.fixed > 0 ? ` plus ${formatPrice(s.fee.fixed, s.currency)}` : ''} of each payment, taken automatically. Stripe&apos;s card fee comes out of each payment too.
      </p>
      <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-full rounded-2xl mt-3 text-sm font-bold" style={{ minHeight: 44, background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>Open Stripe dashboard ↗</a>
    </div>, { text: 'Connected', tone: 'ok' })
}
