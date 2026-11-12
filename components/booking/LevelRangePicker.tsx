'use client'

import { useEffect, useState } from 'react'
import { skillLabelForRating } from '@/lib/skill-levels'
import { clampRange, levelNumber, MAX_RATING, MIN_RATING } from '@/lib/matchmaking'

// "Who should join?" when opening a game: a level range that starts a step either
// side of you, how many players near the club it reaches, and a switch to open it
// to every level. The range is two sliders so it works with a thumb and a keyboard.
export default function LevelRangePicker({ rating, min, max, openToAll, venueSlug, onRange, onOpenToAll }: {
  rating: number | null
  min: number
  max: number
  openToAll: boolean
  venueSlug: string | null
  onRange: (min: number, max: number) => void
  onOpenToAll: (v: boolean) => void
}) {
  // How many players it reaches. Looked up a moment after the range stops moving.
  const [reach, setReach] = useState<number | null | 'error'>(null)
  const lo = openToAll ? MIN_RATING : min
  const hi = openToAll ? MAX_RATING : max
  useEffect(() => {
    if (!venueSlug) { setReach(null); return }
    setReach(null)
    const controller = new AbortController()
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/matchmaking/reach?venue=${encodeURIComponent(venueSlug)}&min=${lo}&max=${hi}`, { signal: controller.signal })
        const body = await res.json().catch(() => ({}))
        setReach(res.ok && typeof body.count === 'number' ? body.count : 'error')
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setReach('error')
      }
    }, 300)
    return () => { clearTimeout(t); controller.abort() }
  }, [venueSlug, lo, hi])

  const pct = (v: number) => ((v - MIN_RATING) / (MAX_RATING - MIN_RATING)) * 100
  const label = (v: number) => `${skillLabelForRating(v)} ${levelNumber(v)}`
  return (
    <div className="rounded-xl p-3.5" data-testid="level-range" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
      <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Who should join?</div>
      <div className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        {rating !== null && !openToAll ? `We've picked a range around your level (${levelNumber(rating)}). Drag to change it.` : openToAll ? 'Every level can ask to join.' : 'Choose the levels that can ask to join.'}
      </div>

      {!openToAll && (
        <>
          <div className="relative h-2.5 rounded-full mt-8 mx-1.5" style={{ background: 'var(--bg-surface)' }}>
            <div className="absolute top-0 h-2.5 rounded-full" style={{ left: `${pct(lo)}%`, width: `${Math.max(pct(hi) - pct(lo), 0)}%`, background: 'var(--brand-primary)' }} />
            {rating !== null && (
              <>
                <span className="absolute -top-6 text-[10px] font-extrabold whitespace-nowrap" style={{ left: `${pct(rating)}%`, transform: 'translateX(-50%)', color: 'var(--brand-primary-text)' }}>You {levelNumber(rating)}</span>
                <span className="absolute -top-0.5 w-3.5 h-3.5 rounded-full" style={{ left: `calc(${pct(rating)}% - 7px)`, background: 'var(--text-primary)', border: '2px solid var(--bg-raised)' }} />
              </>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <label className="block text-[11px] font-bold" style={{ color: 'var(--text-subtle)' }}>
              Lowest level
              <input type="range" aria-label="Lowest level" min={MIN_RATING} max={MAX_RATING} step={0.5} value={lo}
                onChange={e => { const c = clampRange(Number(e.target.value), Math.max(hi, Number(e.target.value) + 0.5)); onRange(c.min, c.max) }}
                className="w-full mt-1" style={{ accentColor: 'var(--brand-primary)' }} />
              <span className="block text-xs font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>{label(lo)}</span>
            </label>
            <label className="block text-[11px] font-bold" style={{ color: 'var(--text-subtle)' }}>
              Highest level
              <input type="range" aria-label="Highest level" min={MIN_RATING} max={MAX_RATING} step={0.5} value={hi}
                onChange={e => { const c = clampRange(Math.min(lo, Number(e.target.value) - 0.5), Number(e.target.value)); onRange(c.min, c.max) }}
                className="w-full mt-1" style={{ accentColor: 'var(--brand-primary)' }} />
              <span className="block text-xs font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>{label(hi)}</span>
            </label>
          </div>
        </>
      )}

      {venueSlug && (
        <div className="mt-3" data-testid="reach">
          <span className="inline-block text-[11px] font-extrabold px-2.5 py-1 rounded-full"
            style={{ background: typeof reach === 'number' && reach > 0 ? 'var(--brand-green-muted)' : 'var(--bg-surface)', color: typeof reach === 'number' && reach > 0 ? 'var(--brand-green)' : 'var(--text-muted)', border: typeof reach === 'number' && reach > 0 ? 'none' : '1px solid var(--border)' }}>
            {reach === null ? 'Checking who it reaches…'
              : reach === 'error' ? 'Could not check who it reaches'
              : reach === 0 ? 'No players near you at this level yet'
              : `About ${reach} ${reach === 1 ? 'player' : 'players'} near you ${reach === 1 ? 'fits' : 'fit'}`}
          </span>
          {typeof reach === 'number' && reach === 0 && !openToAll && (
            <div className="text-[11px] mt-1.5" style={{ color: 'var(--text-subtle)' }}>It may take a while to fill. Widen the range or open it to every level.</div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 mt-3.5 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="min-w-0">
          <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Open to every level</div>
          <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-subtle)' }}>Fills faster, but less even</div>
        </div>
        <button type="button" role="switch" aria-checked={openToAll} aria-label="Open to every level" onClick={() => onOpenToAll(!openToAll)}
          style={{ width: 44, height: 24, borderRadius: 12, flexShrink: 0, background: openToAll ? 'var(--brand-primary)' : 'var(--bg-surface)', border: '1px solid var(--border)', position: 'relative', transition: 'background 0.15s' }}>
          <div style={{ position: 'absolute', top: 2, left: openToAll ? 22 : 2, width: 18, height: 18, borderRadius: 9, background: openToAll ? 'var(--brand-primary-on)' : 'var(--text-subtle)', transition: 'left 0.15s' }} />
        </button>
      </div>
    </div>
  )
}
