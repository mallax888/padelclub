'use client'

import { courtLayout, courtNumber, type ListedPosition } from '@/lib/court-pick'

// "Which court?" on Book a court. Any court first and already chosen, then one big tile for every court laid out the way
// the courts really sit at the club. A court someone else holds at that time is greyed out and cannot be tapped.
const FACE = 'linear-gradient(160deg, #2c5fc4, #1d3f8d)'

export type PickableCourt = { id: string; name: string }

export default function CourtPicker({ courts, listed, freeIds, priceLabel, timeLabel, pickedId, onPick, onContinue }: {
  courts: PickableCourt[]
  listed?: ListedPosition[] | null
  freeIds: Set<string>
  priceLabel: (courtId: string) => string
  timeLabel: string
  pickedId: string | null
  onPick: (courtId: string | null) => void
  onContinue: () => void
}) {
  const layout = courtLayout(courts, listed)
  const picked = pickedId ? courts.find(c => c.id === pickedId) ?? null : null
  const tight = layout.cols >= 3
  return (
    <div className="flex flex-col gap-3.5 animate-fade-in" data-testid="court-picker">
      <button type="button" onClick={() => onPick(null)} aria-pressed={!picked} data-testid="court-any"
        className="flex items-center gap-3.5 rounded-[20px] px-4 py-3 text-left"
        style={picked ? { background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' } : { background: 'var(--today-block-bg)', border: '1px solid transparent', color: 'var(--today-block-fg)', boxShadow: 'var(--today-block-shadow)' }}>
        <span className="flex items-center justify-center shrink-0 font-black text-[16px]" aria-hidden
          style={{ width: 48, height: 48, borderRadius: 15, background: FACE, color: '#ffffff', fontSize: 22 }}>A</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-extrabold">Any court</span>
          <span className="block text-[12.5px]" style={{ color: picked ? 'var(--text-muted)' : 'var(--today-block-fg)' }}>We pick a free one for you</span>
        </span>
        {!picked && <span className="text-[16px] font-extrabold shrink-0" aria-hidden>✓</span>}
      </button>

      <div className="grid gap-3" data-testid="court-grid" data-layout={layout.fromVenue ? 'venue' : 'order'}
        style={{ gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))` }}>
        {layout.cells.map(({ court, col, row }) => {
          const free = freeIds.has(court.id)
          const on = pickedId === court.id
          const num = courtNumber(court.name)
          const short = num !== null ? String(num) : court.name.slice(0, 1).toUpperCase()
          return (
            <button key={court.id} type="button" disabled={!free} onClick={() => onPick(court.id)} aria-pressed={on}
              data-testid={`court-tile-${num ?? court.name}`} data-court={court.name} data-free={free ? 'yes' : 'no'}
              className={`relative flex flex-col justify-between text-left rounded-[22px] ${tight ? 'p-3' : 'p-3.5'}`}
              style={{
                gridColumn: col + 1, gridRow: row + 1, minHeight: tight ? 128 : 148,
                background: on ? 'var(--today-block-bg)' : 'var(--bg-surface)', color: on ? 'var(--today-block-fg)' : 'var(--text-primary)',
                border: on ? '1px solid transparent' : '1px solid var(--border)', boxShadow: on ? 'var(--today-block-shadow)' : 'none',
                opacity: free ? 1 : 0.42, cursor: free ? 'pointer' : 'not-allowed',
              }}>
              <span className="flex items-start justify-between gap-1">
                <span className="flex items-center justify-center font-black" aria-hidden
                  style={{ width: tight ? 50 : 62, height: tight ? 50 : 62, borderRadius: tight ? 15 : 18, background: !free ? 'var(--bg-raised)' : on ? FACE : '#ffffff', color: !free ? 'var(--text-subtle)' : on ? '#ffffff' : '#1d3f8d', fontSize: short.length > 2 ? 18 : tight ? 28 : 36, boxShadow: free ? '0 2px 0 rgba(0,0,0,0.2)' : 'none' }}>{short}</span>
                {on && <span className="text-[16px] font-extrabold" aria-hidden>✓</span>}
              </span>
              <span className="block mt-2">
                <span className="block text-[15px] font-extrabold">{court.name}</span>
                <span className="block text-[12.5px]" style={{ color: on ? 'var(--today-block-fg)' : 'var(--text-muted)' }}>
                  {free ? 'Free' : `Taken at ${timeLabel}`}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <button type="button" onClick={onContinue} data-testid="court-continue" className="w-full rounded-2xl py-3.5 text-[16px] font-extrabold"
        style={{ background: 'var(--brand-primary)', color: '#ffffff', minHeight: 52 }}>
        {picked ? `Continue with ${picked.name}` : 'Continue'}
      </button>
    </div>
  )
}
