'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { currencySymbol, formatPrice, type CurrencyCode } from '@/lib/currency'
import { dailyBreakeven, perDayText, type RunningCosts } from '@/lib/running-costs'

const card = { background: 'var(--bg-surface)', border: '1px solid var(--border)' } as const
const muted = { color: 'var(--text-muted)' } as const
const whole = (n: number, currency: CurrencyCode) => formatPrice(n, currency).replace(/\.00$/, '')

// A club's running costs. They turn into the dashed breakeven line on the Reports chart. Owners only (front desk never sees money).
// The amount saves with the Save button; the on/off switch saves as it is flipped.
export default function RunningCostsSettings({ venueSlug, costs, currency }: { venueSlug: string; costs: RunningCosts | null; currency: CurrencyCode }) {
  const router = useRouter()
  const [c, setC] = useState<RunningCosts | null>(costs)
  const [text, setText] = useState(costs && costs.monthly > 0 ? String(costs.monthly) : '')
  const [busy, setBusy] = useState(false)

  const post = async (patch: { monthly?: number; show?: boolean }, after: (saved: boolean) => void) => {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/running-costs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ venueSlug, ...patch }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data.error ?? 'Could not save.'); after(false) } else { toast.success('Saved'); after(true); router.refresh() }
    } catch { toast.error('Could not save. Check your connection and try again.'); after(false) }
    setBusy(false)
  }
  const typed = text.trim() === '' ? 0 : Number(text.replace(/[, ]/g, ''))
  const valid = Number.isFinite(typed) && typed >= 0 && typed <= 1_000_000
  const changed = c ? typed !== c.monthly : false
  const saveAmount = () => { if (!c || !valid) return; const next = Math.round(typed * 100) / 100; void post({ monthly: next }, ok => { if (ok) setC({ ...c, monthly: next }) }) }
  const flip = () => { if (!c) return; const before = c; setC({ ...c, show: !c.show }); void post({ show: !before.show }, ok => { if (!ok) setC(before) }) }
  const daily = valid && typed > 0 ? dailyBreakeven(typed) : 0

  return (
    <div className="rounded-[20px] p-5" style={card} data-testid="running-costs-settings">
      <div className="flex items-center gap-3">
        <span className="min-w-0">
          <span className="block text-[11px] font-extrabold uppercase" style={{ letterSpacing: '0.12em', color: 'var(--text-subtle)' }}>Running costs</span>
          {c && <span className="block text-[26px] font-black leading-tight mt-1" style={{ letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>{c.monthly > 0 ? `${whole(c.monthly, currency)} a month` : 'Not set'}</span>}
          <span className="block text-xs mt-0.5" style={muted}>{c ? 'What it costs to open the doors: rent, staff, power, balls. It draws a breakeven line on Reports, so you can see which days made money.' : 'Not switched on yet. Run the 042 database change first.'}</span>
        </span>
        <span className="ml-auto self-start shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold" style={{ background: '#4a535d', color: '#fff' }}>owners only</span>
      </div>
      {c && (
        <div className="mt-3 pt-3 grid gap-3" style={{ borderTop: '1px solid var(--border)' }}>
          <div>
            <label htmlFor="running-costs-monthly" className="block text-[11px] font-extrabold uppercase mb-1.5" style={{ letterSpacing: '0.1em', color: 'var(--text-subtle)' }}>Monthly running costs</label>
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-xl px-3 flex-1 max-w-[260px]" style={{ minHeight: 44, background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
                <span className="text-sm font-bold mr-1.5" style={muted}>{currencySymbol(currency)}</span>
                <input id="running-costs-monthly" data-testid="running-costs-input" inputMode="decimal" value={text} placeholder="0" disabled={busy}
                  onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveAmount() }}
                  className="w-full bg-transparent text-lg font-extrabold outline-none" style={{ color: 'var(--text-primary)' }} />
              </div>
              <button type="button" data-testid="running-costs-save" className="btn btn-primary btn-sm" disabled={busy || !valid || !changed} onClick={saveAmount}>{busy ? 'Saving…' : 'Save'}</button>
            </div>
            <p className="text-[12px] mt-1.5 leading-relaxed" style={muted} data-testid="running-costs-daily">
              {!valid ? 'Enter a number, like 9000.' : daily > 0 ? <>That works out at {perDayText(whole(daily, currency))}. PadelMate&apos;s 3% fee is already taken off your takings, so leave it out.</> : 'Leave it empty if you would rather not use the breakeven line.'}
            </p>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>Show the breakeven line on Reports</span>
            <button type="button" role="switch" aria-checked={c.show} aria-label="Show the breakeven line on Reports" disabled={busy} onClick={flip}
              className="shrink-0 relative rounded-full disabled:opacity-60" data-testid="running-costs-switch"
              style={{ width: 46, height: 28, background: c.show ? 'var(--today-block-bg)' : 'var(--bg-raised)', boxShadow: c.show ? 'var(--today-block-shadow)' : 'none', border: '1px solid var(--border)' }}>
              <span aria-hidden className="absolute rounded-full" style={{ top: 3, left: c.show ? 21 : 3, width: 20, height: 20, background: c.show ? 'var(--today-block-fg)' : 'var(--text-subtle)', transition: 'left .15s' }} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
