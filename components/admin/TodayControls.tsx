'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Which club the Today screen is about. A plain select on purpose: it opens the
// phone's own picker, is easy to hit, and needs no custom popover.
export function VenuePicker({ venues, value }: { venues: { slug: string; name: string }[]; value: string }) {
  const router = useRouter()
  if (venues.length <= 1) {
    return (
      <div className="inline-flex items-center rounded-full px-3.5 text-[12.5px] font-bold min-w-0"
        style={{ minHeight: 40, background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
        <span className="truncate">{venues[0]?.name ?? 'Your club'}</span>
      </div>
    )
  }
  return (
    <label className="relative inline-flex items-center min-w-0">
      <span className="sr-only">Club</span>
      <select value={value} onChange={e => router.push(`/admin/today?venue=${encodeURIComponent(e.target.value)}`)}
        className="rounded-full pl-3.5 pr-8 text-[12.5px] font-bold min-w-0 max-w-full appearance-none"
        style={{ minHeight: 40, background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
        {venues.map(v => <option key={v.slug} value={v.slug}>{v.name}</option>)}
      </select>
      <span aria-hidden className="pointer-events-none absolute right-3 text-xs" style={{ color: 'var(--text-subtle)' }}>▾</span>
    </label>
  )
}

// A screen left open on the front desk should keep telling the truth: reload the
// numbers every minute while the tab is visible.
export function AutoRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter()
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') router.refresh() }, seconds * 1000)
    return () => clearInterval(t)
  }, [router, seconds])
  return null
}
