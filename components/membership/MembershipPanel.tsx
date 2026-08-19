'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { cn, formatNzd } from '@/lib/utils'
import { MEMBERSHIP_CONFIG } from '@/types/database'
import type { Profile, CreditTransaction, MembershipTier } from '@/types/database'
import { CREDIT_PACKS } from '@/lib/creditPacks'

export default function MembershipPanel({
  profile,
  transactions,
}: {
  profile: Profile
  transactions: CreditTransaction[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selectedPack, setSelectedPack] = useState<string | null>(null)
  const [upgrading, setUpgrading] = useState(false)
  const [purchasing, setPurchasing] = useState(false)
  const [showBookingPrompt, setShowBookingPrompt] = useState<string | null>(null)

  const currentTier = profile?.membership_tier ?? 'casual'
  const currentMem = MEMBERSHIP_CONFIG[currentTier]

  // Paid upgrades finish with a redirect back from Stripe rather than
  // resolving synchronously, so the "welcome" prompt fires off the
  // ?payment=success param (and the freshly-reloaded profile) instead of
  // straight out of handleUpgrade.
  useEffect(() => {
    if (searchParams.get('payment') === 'success' && currentTier !== 'casual') {
      setShowBookingPrompt(MEMBERSHIP_CONFIG[currentTier].name)
      router.replace('/membership')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleUpgrade = async (tier: MembershipTier) => {
    if (tier === currentTier) return
    setUpgrading(true)
    if (tier === 'casual') {
      const res = await fetch('/api/membership/downgrade', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Could not update membership.')
      } else {
        toast.success('Switched to Casual.')
        router.refresh()
      }
      setUpgrading(false)
      return
    }
    const res = await fetch('/api/checkout-membership', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier }),
    })
    const data = await res.json()
    if (!res.ok || !data.url) {
      toast.error(data.error ?? 'Could not start checkout — please try again.')
      setUpgrading(false)
      return
    }
    window.location.href = data.url
  }

  const handlePurchase = async () => {
    if (!selectedPack) return
    setPurchasing(true)
    try {
      const res = await fetch('/api/checkout-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId: selectedPack }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        toast.error(data.error || 'Could not start checkout — please try again.')
        setPurchasing(false)
      }
    } catch (e) {
      toast.error('Could not start checkout — please try again.')
      setPurchasing(false)
    }
  }

  return (
    <div style={{ userSelect: 'none' }}>
      {/* Current plan summary */}
      <div className="rounded-2xl p-5 mb-6 flex items-center gap-4"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
          style={{ background: 'var(--brand-primary-muted)' }}>🏅</div>
        <div className="flex-1">
          <div className="text-xs mb-0.5" style={{ color: 'var(--text-subtle)' }}>Current plan</div>
          <div className="font-semibold capitalize" style={{ color: 'var(--text-primary)' }}>
            {currentMem.name} member
          </div>
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {currentMem.discount > 0 ? `${(currentMem.discount * 100).toFixed(0)}% discount · ` : ''}
            {profile?.credits ?? 0} credits remaining
          </div>
        </div>
      </div>

      {/* Plan cards */}
      <h2 className="text-base font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
        Choose a plan
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {Object.values(MEMBERSHIP_CONFIG).map(mem => {
          const isCurrent = currentTier === mem.id
          return (
            <div
              key={mem.id}
              className="relative flex flex-col rounded-2xl p-5"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                boxShadow: isCurrent ? '0 0 0 1px var(--ring-primary), 0 30px 70px -20px var(--ring-primary)' : 'var(--shadow-float)',
              }}
            >
              {mem.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs px-3 py-1 rounded-full whitespace-nowrap font-semibold"
                  style={{ background: 'var(--brand-primary)', color: 'var(--brand-primary-on)' }}>
                  Most popular
                </div>
              )}
              <div className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{mem.name}</div>
              <div className="text-2xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                {mem.priceNzd === 0 ? 'Free' : formatNzd(mem.priceNzd)}
                <span className="text-sm font-normal" style={{ color: 'var(--text-muted)' }}>
                  {mem.period !== 'free' ? mem.period : ''}
                </span>
              </div>
              <ul className="space-y-1.5 mt-3 flex-1">
                {mem.features.map(f => (
                  <li key={f} className="text-sm flex items-start gap-2" style={{ color: 'var(--text-muted)' }}>
                    <span className="mt-0.5 shrink-0" style={{ color: 'var(--brand-primary)', fontWeight: 700, fontSize: '0.95rem' }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                className={isCurrent ? 'btn w-full justify-center mt-4' : 'btn btn-primary w-full justify-center mt-4'}
                disabled={isCurrent || upgrading}
                style={{
                  cursor: isCurrent ? 'default' : 'pointer',
                  background: isCurrent ? 'var(--brand-primary-muted)' : undefined,
                  color: isCurrent ? 'var(--brand-primary)' : undefined,
                  border: isCurrent ? '1px solid var(--brand-primary)' : undefined,
                  fontWeight: 600,
                }}
                onClick={() => handleUpgrade(mem.id as MembershipTier)}
              >
                {isCurrent ? '✓ Current plan' : `Select ${mem.name}`}
              </button>
            </div>
          )
        })}
      </div>

      {/* Credit packs */}
      <h2 className="text-base font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
        Session credit packs
      </h2>
      <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
        Pre-buy sessions at a discount — use any time, on any court
      </p>
      <div className="grid grid-cols-3 gap-3 mb-4">
        {CREDIT_PACKS.map(pack => {
          const isSelected = selectedPack === pack.id
          return (
            <div
              key={pack.id}
              onClick={() => setSelectedPack(isSelected ? null : pack.id)}
              className="cursor-pointer text-center transition-all rounded-2xl p-5"
              style={{
                background: isSelected ? 'var(--brand-primary-muted)' : 'var(--bg-surface)',
                border: `1px solid ${isSelected ? 'var(--brand-primary)' : 'var(--border)'}`,
                boxShadow: isSelected ? '0 0 0 1px var(--ring-primary), 0 20px 40px -15px var(--ring-primary)' : 'var(--shadow-float)',
              }}
            >
              <div className="text-3xl font-semibold" style={{ color: 'var(--brand-primary)' }}>
                {pack.sessions}
              </div>
              <div className="text-xs mb-1" style={{ color: 'var(--text-subtle)' }}>sessions</div>
              <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                {formatNzd(pack.priceNzd)}
              </div>
              {pack.save && (
                <div className="text-xs mt-0.5" style={{ color: 'var(--brand-accent)' }}>{pack.save}</div>
              )}
            </div>
          )
        })}
      </div>

      {selectedPack && (
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            {CREDIT_PACKS.find(p => p.id === selectedPack)?.sessions} sessions for{' '}
            {formatNzd(CREDIT_PACKS.find(p => p.id === selectedPack)?.priceNzd ?? 0)}
          </div>
          <button className="btn btn-primary" disabled={purchasing} onClick={handlePurchase}>
            {purchasing ? 'Processing…' : 'Purchase credits'}
          </button>
        </div>
      )}

      {/* Transaction history */}
      {transactions.length > 0 && (
        <div>
          <h2 className="text-base font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
            Credit history
          </h2>
          <div className="rounded-2xl overflow-hidden"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: 'var(--text-subtle)' }}>Date</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: 'var(--text-subtle)' }}>Description</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium" style={{ color: 'var(--text-subtle)' }}>Credits</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(tx => (
                  <tr key={tx.id}
                    className="last:border-0 transition-colors"
                    style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-raised)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
                      {tx.created_at.slice(0, 10)}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: 'var(--text-primary)', userSelect: 'text' }}>
                      {tx.description}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium"
                      style={{ color: tx.amount > 0 ? 'var(--brand-primary)' : 'var(--brand-accent)' }}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Booking prompt after upgrade */}
      {showBookingPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={e => e.target === e.currentTarget && setShowBookingPrompt(null)}>
          <div className="rounded-2xl p-6 w-full max-w-sm text-center"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--brand-primary)', boxShadow: 'var(--glow-primary)' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🎾</div>
            <div className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
              Welcome to {showBookingPrompt}!
            </div>
            <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
              Your new perks are active now. Ready to put them to use?
            </p>
            <button
              className="w-full py-3 rounded-xl text-sm font-bold transition-all mb-2"
              style={{ background: 'var(--brand-primary)', color: 'var(--brand-primary-on)', boxShadow: 'var(--glow-primary)' }}
              onClick={() => router.push('/book')}
            >
              New booking →
            </button>
            <button
              className="w-full py-2 text-xs font-medium"
              style={{ color: 'var(--text-muted)' }}
              onClick={() => setShowBookingPrompt(null)}
            >
              Maybe later
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
