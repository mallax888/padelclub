'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { cn, formatNzd } from '@/lib/utils'
import { MEMBERSHIP_CONFIG } from '@/types/database'
import type { Profile, CreditTransaction, MembershipTier } from '@/types/database'

const CREDIT_PACKS = [
  { id: 'pack5',  sessions: 5,  priceNzd: 150, save: null },
  { id: 'pack10', sessions: 10, priceNzd: 270, save: 'Save $30' },
  { id: 'pack20', sessions: 20, priceNzd: 500, save: 'Save $100' },
]

export default function MembershipPanel({
  profile,
  transactions,
}: {
  profile: Profile
  transactions: CreditTransaction[]
}) {
  const supabase = createClient()
  const router = useRouter()
  const [selectedPack, setSelectedPack] = useState<string | null>(null)
  const [upgrading, setUpgrading] = useState(false)
  const [purchasing, setPurchasing] = useState(false)

  const currentTier = profile?.membership_tier ?? 'casual'
  const currentMem = MEMBERSHIP_CONFIG[currentTier]

  const handleUpgrade = async (tier: MembershipTier) => {
    if (tier === currentTier) return
    setUpgrading(true)
    const { error } = await (supabase as any)
      .from('profiles')
      .update({ membership_tier: tier })
      .eq('id', profile.id)
    if (error) {
      toast.error('Could not update membership.')
    } else {
      toast.success(`Upgraded to ${MEMBERSHIP_CONFIG[tier].name}!`)
      router.refresh()
    }
    setUpgrading(false)
  }

  const handlePurchase = async () => {
    if (!selectedPack) return
    const pack = CREDIT_PACKS.find(p => p.id === selectedPack)!
    setPurchasing(true)
    const { error: txErr } = await (supabase as any)
      .from('credit_transactions')
      .insert({
        user_id: profile.id,
        amount: pack.sessions,
        type: 'purchase',
        description: `Purchased ${pack.sessions}-session pack`,
      })
    if (!txErr) {
      await (supabase as any)
        .from('profiles')
        .update({ credits: (profile?.credits ?? 0) + pack.sessions })
        .eq('id', profile.id)
      toast.success(`${pack.sessions} credits added!`)
      setSelectedPack(null)
      router.refresh()
    } else {
      toast.error('Purchase failed — please try again.')
    }
    setPurchasing(false)
  }

  return (
    <div style={{ userSelect: 'none' }}>
      {/* Current plan summary */}
      <div className="rounded-xl p-5 mb-6 flex items-center gap-4"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
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
              className="relative flex flex-col rounded-xl p-5"
              style={{
                background: 'var(--bg-surface)',
                border: `${isCurrent ? '2px' : '1px'} solid ${isCurrent ? 'var(--brand-primary)' : 'var(--border)'}`,
                boxShadow: isCurrent ? 'var(--glow-primary)' : 'none',
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
                    <span className="mt-0.5 shrink-0" style={{ color: 'var(--brand-primary)' }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                className="btn btn-primary w-full justify-center mt-4"
                disabled={isCurrent || upgrading}
                style={{
                  cursor: isCurrent ? 'default' : 'pointer',
                  opacity: isCurrent ? 0.5 : 1,
                }}
                onClick={() => handleUpgrade(mem.id as MembershipTier)}
              >
                {isCurrent ? 'Current plan' : `Select ${mem.name}`}
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
              className="cursor-pointer text-center transition-all rounded-xl p-5"
              style={{
                background: isSelected ? 'var(--brand-primary-muted)' : 'var(--bg-surface)',
                border: `1px solid ${isSelected ? 'var(--brand-primary)' : 'var(--border)'}`,
                boxShadow: isSelected ? 'var(--glow-primary)' : 'none',
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
          <div className="rounded-xl overflow-hidden"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
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
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-subtle)' }}>
                      {tx.created_at.slice(0, 10)}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: 'var(--text-primary)', userSelect: 'text' }}>
                      {tx.description}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium"
                      style={{ color: tx.amount > 0 ? 'var(--brand-primary)' : '#FF2D78' }}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
