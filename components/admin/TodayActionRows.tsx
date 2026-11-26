'use client'

import { fmtClock } from '@/lib/clock'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import OfferSheet from '@/components/admin/OfferSheet'
import { formatPrice, type CurrencyCode } from '@/lib/currency'
import { formatDate } from '@/lib/utils'
import { reminderButton, reminderCounts, type FillGap, type OverdueLine } from '@/lib/today-actions'
import MoneyBubble from '@/components/ui/MoneyBubble'

// The two jobs an owner can do from Needs attention on Today, each right where it is listed: send a reminder to
// everyone who owes, and offer a discount to fill the biggest gap. Each opens a sheet over Today, does the job,
// and then the row says what was done.

function Shell({ tone, mark, title, text, children, done, testid, bubble }: { tone: 'red' | 'blue'; mark: string; title: string; text: string; children?: React.ReactNode; done?: boolean; testid: string; bubble?: React.ReactNode }) {
  const color = done ? 'var(--brand-primary-text)' : tone === 'red' ? 'var(--brand-crimson)' : 'var(--brand-primary-text)'
  const bg = done ? 'var(--brand-primary-muted)' : tone === 'red' ? 'var(--brand-crimson-muted)' : 'var(--brand-primary-muted)'
  return (
    <div className="flex items-center gap-3 px-3.5 py-3" style={{ minHeight: 60, borderBottom: '1px solid var(--border)' }} data-testid={testid} data-done={done ? 'true' : 'false'}>
      <span aria-hidden className="inline-flex items-center justify-center rounded-[11px] font-extrabold shrink-0" style={{ width: 34, height: 34, background: bg, color }}>{done ? '✓' : mark}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-bold" style={{ color: 'var(--text-primary)' }}>{title}</span>
        <span className="block text-[11.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{text}</span>
      </span>
      {bubble}
      {children}
    </div>
  )
}
const Action = ({ children, onClick, testid, hero }: { children: React.ReactNode; onClick: () => void; testid: string; hero?: boolean }) => (
  <button type="button" onClick={onClick} data-testid={testid} className={hero ? 'shrink-0 rounded-[12px] px-4 text-[13px] font-extrabold' : 'shrink-0 rounded-[10px] px-3.5 text-[12.5px] font-extrabold'}
    style={hero ? { minHeight: 42, background: '#d4f53c', color: '#17240a' } : { minHeight: 38, background: 'var(--brand-primary)', color: 'var(--brand-primary-on)' }}>{children}</button>
)

function Dialog({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }} role="dialog" aria-modal="true" aria-label={label} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl p-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>{children}</div>
    </div>
  )
}

export function OverdueRow({ currency, lines, total, notDueCount, notDueTotal, autoOpen }: {
  currency: CurrencyCode; lines: OverdueLine[]; total: number; notDueCount: number; notDueTotal: number; autoOpen: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(autoOpen)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<{ told: number } | null>(null)
  // Reminders sent one at a time from the pop-up: 'busy' while sending, 'sent' once done. A share that has been reminded is
  // left out of "Remind everyone left", so nobody is nudged twice by accident.
  const [one, setOne] = useState<Record<string, 'busy' | 'sent'>>({})
  const [told, setTold] = useState(0)
  useEffect(() => { if (autoOpen) setOpen(true) }, [autoOpen])
  const left = lines.filter(l => one[l.id] !== 'sent')
  const counts = reminderCounts(left)
  const money = (n: number) => formatPrice(n, currency)
  const someSent = left.length < lines.length

  async function post(id: string): Promise<number | null> {
    try {
      const res = await fetch('/api/admin/remind-shares', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
      if (!res.ok) return null
      return (await res.json().catch(() => ({ told: 0 }))).told ?? 0
    } catch { return null }
  }

  async function remindOne(id: string) {
    setError(null); setOne(o => ({ ...o, [id]: 'busy' }))
    const n = await post(id)
    if (n === null) { setOne(o => { const c = { ...o }; delete c[id]; return c }); setError('We could not send that reminder. Please try again in a moment.'); return }
    setOne(o => ({ ...o, [id]: 'sent' })); setTold(t => t + n)
    // That was the last one: same ending as "Remind all".
    if (lines.every(l => l.id === id || one[l.id] === 'sent')) { setSent({ told: told + n }); setOpen(false); router.refresh() }
  }

  async function remindAll() {
    setBusy(true); setError(null)
    let n = told, failed = 0
    for (const l of left) {
      const r = await post(l.id)
      if (r === null) failed++
      else { n += r; setOne(o => ({ ...o, [l.id]: 'sent' })) }
    }
    setBusy(false)
    if (failed > 0 && failed === left.length && !someSent) { setError('We could not send the reminders. Please try again in a moment.'); return }
    if (failed > 0) setError(`${failed} of ${left.length} could not be sent.`)
    setTold(n); setSent({ told: n }); if (failed === 0) setOpen(false)
    router.refresh()
  }

  const title = `${lines.length} ${lines.length === 1 ? 'share' : 'shares'} overdue`
  const more = notDueCount > 0 ? `${notDueCount} more (${money(notDueTotal)}) ${notDueCount === 1 ? 'is' : 'are'} not due yet. Those remind themselves.` : 'Friends past the time they had to pay their part.'
  const allCounts = reminderCounts(lines)
  return (
    <>
      {sent
        ? <Shell tone="red" mark="$" done testid="overdue-row" title="Reminders sent" text={`${allCounts.friends} ${allCounts.friends === 1 ? 'friend' : 'friends'} and ${allCounts.organisers === 1 ? 'the organiser' : 'the organisers'} have been told, just now.`} />
        : <Shell tone="red" mark="$" testid="overdue-row" title={title} text={more} bubble={<MoneyBubble kind="loss" size={14} testId="overdue-amount">{money(total)}</MoneyBubble>}><Action testid="remind-all" onClick={() => setOpen(true)}>Remind all</Action></Shell>}
      {open && (
        <Dialog label="Remind overdue shares" onClose={() => { if (!busy) setOpen(false) }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-extrabold" style={{ color: 'var(--text-primary)' }}>Remind about {lines.length} overdue {lines.length === 1 ? 'share' : 'shares'}</h3>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Each friend gets a nudge, and so does the person who booked. Remind one share at a time, or everyone left.</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} disabled={busy} aria-label="Close" className="text-xl leading-none px-2" style={{ color: 'var(--text-muted)' }}>×</button>
          </div>
          <div className="mt-4 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }} data-testid="remind-list">
            {lines.map(l => (
              <div key={l.id} className="flex items-center justify-between gap-3 px-3 py-2.5" style={{ borderBottom: '1px solid var(--border)' }} data-testid="remind-line">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold truncate" style={{ color: 'var(--text-primary)' }}>{l.playerName}</div>
                  <div className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>{l.courtName} · {formatDate(l.date)} {fmtClock(String(l.startTime))}{l.organiserName ? ` · booked by ${l.organiserName}` : ''}</div>
                </div>
                <MoneyBubble kind="loss" size={12} testId="overdue-line-amount">{money(l.amount)}</MoneyBubble>
                {one[l.id] === 'sent'
                  ? <span data-testid="remind-done" className="shrink-0 rounded-[10px] px-3 text-[12px] font-extrabold inline-flex items-center" style={{ minHeight: 36, background: 'var(--brand-green-muted)', color: 'var(--brand-green)', border: '1px solid var(--brand-green)' }}>✓ Reminded</span>
                  : <button type="button" onClick={() => void remindOne(l.id)} disabled={busy || one[l.id] === 'busy'} data-testid="remind-one" aria-label={`Remind about ${l.playerName}, ${money(l.amount)}`}
                      className="shrink-0 rounded-[10px] px-3 text-[12px] font-extrabold disabled:opacity-60" style={{ minHeight: 36, background: 'var(--bg-raised)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                      {one[l.id] === 'busy' ? 'Sending…' : 'Remind'}
                    </button>}
              </div>
            ))}
          </div>
          <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>{money(total)} in total. They have all passed their pay-by time.</p>
          {error && <p role="alert" className="text-xs mt-2" style={{ color: 'var(--brand-crimson)' }}>{error}</p>}
          <button type="button" onClick={() => void remindAll()} disabled={busy || left.length === 0} data-testid="remind-send"
            className="flex items-center justify-center w-full rounded-2xl mt-4 text-[14.5px] font-extrabold disabled:opacity-60" style={{ minHeight: 48, background: 'var(--brand-primary)', color: 'var(--brand-primary-on)' }}>
            {busy ? 'Sending…' : someSent ? `Remind everyone left (${counts.friends} ${counts.friends === 1 ? 'friend' : 'friends'}${counts.organisers > 0 ? ` and ${counts.organisers} ${counts.organisers === 1 ? 'organiser' : 'organisers'}` : ''})` : reminderButton(counts)}
          </button>
        </Dialog>
      )}
    </>
  )
}

export function FillButton({ venueSlug, gap, bounds, autoOpen, hero }: {
  venueSlug: string; gap: FillGap; bounds: { from: string; to: string }; autoOpen: boolean; hero?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(autoOpen)
  const [sent, setSent] = useState(false)
  useEffect(() => { if (autoOpen) setOpen(true) }, [autoOpen])
  return (
    <>
      {sent
        ? <span data-testid="fill-row" data-done="true" className="shrink-0 rounded-full px-3 py-1.5 text-[12px] font-extrabold" style={hero ? { background: '#ffffff26', color: '#ffffff' } : { background: 'var(--brand-primary-muted)', color: 'var(--brand-primary-text)' }}>✓ Offer sent · {gap.from}–{gap.to}</span>
        : <span data-testid="fill-row" data-done="false" className="shrink-0"><Action testid="fill-them" hero={hero} onClick={() => setOpen(true)}>Fill them</Action></span>}
      {open && <OfferSheet venueSlug={venueSlug} date={gap.date} from={gap.from} to={gap.to} bounds={bounds} onClose={() => setOpen(false)} onSent={() => { setOpen(false); setSent(true); router.refresh() }} />}
    </>
  )
}
