'use client'

import { useRouter } from 'next/navigation'
import { rememberViewMode } from '@/lib/view-mode'

// Shown on Today when a link took a manager to a page that belongs to the player side.
// Managers stay on the manager side unless they choose otherwise, so this offers the way across.
export default function PlayerPageNotice({ path, name }: { path: string; name: string }) {
  const router = useRouter()
  const go = () => { rememberViewMode('player'); router.push(path); router.refresh() }
  return (
    <div className="rounded-2xl p-4 mb-4 flex flex-wrap items-center justify-between gap-3" data-testid="player-page-notice"
      style={{ background: 'var(--brand-primary-muted)', border: '1px solid var(--brand-primary)' }}>
      <div className="min-w-0">
        <div className="text-[15px] font-extrabold" style={{ color: 'var(--text-primary)' }}>{name} is on the player side</div>
        <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>You are in Manager view. Switch to Player view to open it.</div>
      </div>
      <button type="button" onClick={go} data-testid="switch-to-player" className="rounded-xl px-4 text-sm font-extrabold shrink-0"
        style={{ minHeight: 44, background: 'var(--brand-primary)', color: 'var(--brand-primary-on)' }}>Switch to Player view</button>
    </div>
  )
}
