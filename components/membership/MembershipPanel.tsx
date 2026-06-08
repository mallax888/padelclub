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
    <div>
      {/* Current plan summary */}
      <div className="card mb-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-[#00FF87]/10 flex items-center justify-center text-2xl shrink-0">🏅</div>
        <div className="flex-1">
          <div className="text-xs text-gray-500 mb-0.5">Current plan</div>
          <div className="font-semibold capitalize">{currentMem.name} member</div>
          <div className="text-sm text-gray-500">
            {currentMem.discount > 0 ? `${(currentMem.discount*100).toFixed(0)}% discount · ` : ''}
            {profile?.credits ?? 0} credits remaining
          </div>
        </div>
      </div>

      {/* Plan cards */}
      <h2 className="text-base font-medium mb-3">Choose a plan</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {Object.values(MEMBERSHIP_CONFIG).map(mem => {
          const isCurrent = currentTier === mem.id
          return (
            <div
              key={mem.id}
              className={cn(
                'card relative flex flex-col',
                
                isCurrent && 'border-[#00FF87] ring-2 ring-[#00FF87]/20 border-2'
              )}
            >
              {mem.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#00FF87] text-black text-xs px-3 py-1 rounded-full whitespace-nowrap font-semibold">
                  Most popular
                </div>
              )}
              <div className="font-semibold mb-1">{mem.name}</div>
              <div className="text-2xl font-semibold mb-1 text-white">
                {mem.priceNzd === 0 ? 'Free' : formatNzd(mem.priceNzd)}
                <span className="text-sm font-normal text-gray-500">{mem.period !== 'free' ? mem.period : ''}</span>
              </div>
              <ul className="space-y-1.5 mt-3 flex-1 select-none">
                {mem.features.map(f => (
                  <li key={f} className="text-sm text-gray-400 flex items-start gap-2">
                    <span className="text-[#00FF87] mt-0.5 shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
className={cn(
                  'btn w-full justify-center mt-4',
                  !isCurrent && mem.id !== 'casual' && 'btn-primary',
                  isCurrent && 'opacity-50',
                  mem.id === 'casual' && !isCurrent && 'border-gray-600 text-gray-400'
                )}
                disabled={isCurrent || upgrading}
                style={{ cursor: isCurrent ? 'default' : 'pointer', userSelect: 'none' }}
                onClick={() => handleUpgrade(mem.id as MembershipTier)}
              >
                {isCurrent ? 'Current plan' : `Select ${mem.name}`}
              </button>
            </div>
          )
        })}
      </div>

      {/* Credit packs */}
      <h2 className="text-base font-medium mb-1">Session credit packs</h2>
      <p className="text-sm text-gray-500 mb-3">Pre-buy sessions at a discount — use any time, on any court</p>
      <div className="grid grid-cols-3 gap-3 mb-4">
        {CREDIT_PACKS.map(pack => (
          <div
            key={pack.id}
            onClick={() => setSelectedPack(selectedPack === pack.id ? null : pack.id)}
            className={cn(
              'card cursor-pointer text-center transition-all hover:border-[#00FF87]',
              selectedPack === pack.id && 'border-[#00FF87] ring-2 ring-[#00FF87]/10'
            )}
          >
            <div className="text-3xl font-semibold text-[#00FF87]">{pack.sessions}</div>
            <div className="text-xs text-gray-500 mb-1">sessions</div>
            <div className="font-semibold text-sm text-white">{formatNzd(pack.priceNzd)}</div>
            {pack.save && <div className="text-xs text-[#00FF87] mt-0.5">{pack.save}</div>}
          </div>
        ))}
      </div>

      {selectedPack && (
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 text-sm text-gray-500">
            {CREDIT_PACKS.find(p => p.id === selectedPack)?.sessions} sessions for{' '}
            {formatNzd(CREDIT_PACKS.find(p => p.id === selectedPack)?.priceNzd ?? 0)}
          </div>
          <button
            className="btn btn-primary"
            disabled={purchasing}
            onClick={handlePurchase}
          >
            {purchasing ? 'Processing…' : 'Purchase credits'}
          </button>
        </div>
      )}

      {/* Transaction history */}
      {transactions.length > 0 && (
        <div>
          <h2 className="text-base font-medium mb-3">Credit history</h2>
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#3A3A3A]">
                  <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Date</th>
                  <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Description</th>
                  <th className="text-right px-4 py-2.5 text-xs text-gray-500 font-medium">Credits</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(tx => (
                  <tr key={tx.id} className="border-b border-[#3A3A3A] last:border-0 hover:bg-[#2A2A2A]">
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{tx.created_at.slice(0,10)}</td>
                    <td className="px-4 py-2.5 text-gray-300">{tx.description}</td>
                    <td className={cn('px-4 py-2.5 text-right font-medium', tx.amount > 0 ? 'text-[#00FF87]' : 'text-red-400')}>
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
