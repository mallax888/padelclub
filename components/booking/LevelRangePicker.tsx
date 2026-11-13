'use client'

import { useEffect, useState } from 'react'
import { skillLabelForRating } from '@/lib/skill-levels'
import { clampRange, levelNumber, MAX_RATING, MIN_RATING } from '@/lib/matchmaking'
import { ANY_RANGE, LEVEL_BANDS, activePreset, bandIndexOf, coverage, describeRange, presetRanges, toggleBand } from '@/lib/level-bands'

// "Who should join?" when opening a game. Three layers that always agree: quick choices
// (similar to me / a bit wider / any level) with how many players each reaches; the five named
// levels to tap; and, if wanted, an exact two-handle slider. Tapping a level makes the range
// "Custom". See lib/level-bands.ts for the rules.
export default function LevelRangePicker({ rating, min, max, openToAll, venueSlug, onRange, onOpenToAll }: {
  rating: number | null
  min: number
  max: number
  openToAll: boolean
  venueSlug: string | null
  onRange: (min: number, max: number) => void
  onOpenToAll: (v: boolean) => void
}) {
  const [reach, setReach] = useState<number | null | 'error'>(null) // players the current range reaches
  const [counts, setCounts] = useState<{ similar: number | null; wider: number | null; any: number; bands: number[] } | null>(null)
  const [fine, setFine] = useState(false)

  const range = openToAll ? ANY_RANGE : { min, max }
  const lo = range.min, hi = range.max
  const presets = presetRanges(rating)
  const active = activePreset(range, openToAll, rating)
  const cover = coverage(range)
  const mine = rating !== null ? bandIndexOf(rating) : -1

  // How many players the current range reaches. Looked up a moment after the range stops moving.
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

  // How many players each quick choice and each level reaches: one request, once per club and level.
  useEffect(() => {
    setCounts(null)
    if (!venueSlug) return
    const list = [...(presets ? [presets.similar, presets.wider] : []), ANY_RANGE, ...LEVEL_BANDS.map(b => ({ min: b.lo, max: b.hi }))]
    const controller = new AbortController()
    ;(async () => {
      try {
        const res = await fetch(`/api/matchmaking/reach?venue=${encodeURIComponent(venueSlug)}&ranges=${list.map(r => `${r.min}:${r.max}`).join(',')}`, { signal: controller.signal })
        const body = await res.json().catch(() => ({}))
        if (!res.ok || !Array.isArray(body.counts)) return
        const c: number[] = body.counts
        const o = presets ? 2 : 0
        setCounts({ similar: presets ? c[0] : null, wider: presets ? c[1] : null, any: c[o], bands: c.slice(o + 1) })
      } catch { /* the counts are a nicety: without them the choices still work */ }
    })()
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueSlug, rating])

  const pct = (v: number) => (v - MIN_RATING) / (MAX_RATING - MIN_RATING)
  const pos = (v: number) => `calc(12px + (100% - 24px) * ${pct(v)})`

  const chooseRange = (r: { min: number; max: number }) => { onOpenToAll(false); onRange(r.min, r.max) }
  const tapBand = (i: number) => { if (openToAll) chooseRange({ min: LEVEL_BANDS[i].lo, max: LEVEL_BANDS[i].hi }); else { const r = toggleBand(range, i); onRange(r.min, r.max) } }

  const choices: { id: 'similar' | 'wider' | 'any'; title: string; sub: string; n: number | null; pick: () => void }[] = [
    ...(presets ? [
      { id: 'similar' as const, title: 'Similar to me', sub: 'Your level only', n: counts?.similar ?? null, pick: () => chooseRange(presets.similar) },
      { id: 'wider' as const, title: 'A bit wider', sub: 'One level either side', n: counts?.wider ?? null, pick: () => chooseRange(presets.wider) },
    ] : []),
    { id: 'any' as const, title: 'Any level', sub: 'Fills fastest, least even', n: counts?.any ?? null, pick: () => onOpenToAll(true) },
  ]

  return (
    <div className="rounded-xl p-3.5" data-testid="level-range" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
      <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Who should join?</div>
      <div className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        {presets ? 'Pick how wide to go. Most people stop here.' : 'Choose the levels that can ask to join.'}
      </div>

      <div role="radiogroup" aria-label="Who should join" className="flex flex-col gap-1.5 mt-3">
        {choices.map(c => {
          const on = active === c.id
          return (
            <button key={c.id} type="button" role="radio" aria-checked={on} data-testid={`level-preset-${c.id}`} onClick={c.pick}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left"
              style={{ background: on ? 'var(--brand-primary-muted)' : 'var(--bg-surface)', border: `1px solid ${on ? 'var(--brand-primary)' : 'var(--border)'}` }}>
              <span aria-hidden className="shrink-0 rounded-full" style={{ width: 17, height: 17, background: on ? '#fff' : 'transparent', border: on ? '5px solid var(--brand-primary)' : '2px solid var(--text-subtle)' }} />
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>{c.title}</span>
                <span className="block text-[11px]" style={{ color: 'var(--text-muted)' }}>{c.sub}</span>
              </span>
              {c.n !== null && <span className="text-[11px] font-extrabold" style={{ color: 'var(--brand-green)' }}>~{c.n}</span>}
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-2 mt-4 mb-2 text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>
        Levels that can join
        {active === null && <span data-testid="level-custom" className="rounded-full px-2 py-px text-[10px]" style={{ background: 'var(--brand-yellow)', color: 'var(--brand-yellow-on)' }}>Custom</span>}
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Levels that can join">
        {LEVEL_BANDS.map((b, i) => {
          const c = cover[i]
          return (
            <button key={b.value} type="button" aria-pressed={c === 'full'} data-testid={`level-band-${b.value}`} data-cover={c} onClick={() => tapBand(i)}
              className="flex flex-1 basis-auto flex-col items-center gap-0.5 rounded-xl px-3 pt-2.5 pb-2"
              style={{
                background: c === 'full' ? 'var(--brand-primary)' : 'var(--bg-surface)',
                border: `1px solid ${c === 'none' ? 'var(--border)' : 'var(--brand-primary)'}`,
                boxShadow: i === mine ? 'inset 0 0 0 2px var(--brand-yellow)' : 'none',
                color: c === 'full' ? 'var(--brand-primary-on)' : 'var(--text-primary)',
              }}>
              <span className="text-[12px] font-extrabold leading-tight">{b.label}</span>
              <span className="text-[10px]" style={{ opacity: 0.75 }}>{b.lo === MIN_RATING ? `up to ${b.hi}` : b.hi === MAX_RATING ? `${b.lo}+` : `${b.lo} – ${b.hi}`}</span>
              {counts && <span className="text-[11px] font-extrabold mt-0.5" style={{ color: c === 'full' ? '#fff' : 'var(--brand-green)' }}>{counts.bands[i]}</span>}
            </button>
          )
        })}
      </div>
      {rating !== null && (
        <div className="flex items-center gap-1.5 mt-1.5 text-[10px]" style={{ color: 'var(--text-subtle)' }}>
          <span aria-hidden style={{ width: 10, height: 10, borderRadius: 3, boxShadow: 'inset 0 0 0 2px var(--brand-yellow)' }} />
          You ({levelNumber(rating)}, {skillLabelForRating(rating)}){counts ? ' · numbers show players at each level' : ''}
        </div>
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

      {!openToAll && (
        <div className="mt-3 pt-2.5" style={{ borderTop: '1px solid var(--border)' }}>
          <button type="button" aria-expanded={fine} data-testid="level-fine" onClick={() => setFine(!fine)} className="text-xs font-bold" style={{ color: 'var(--brand-primary-text)' }}>
            {fine ? 'Hide the exact range ‹' : 'Fine-tune the exact range ›'}
          </button>
          {fine && (
            <div className="mt-2" data-testid="level-exact">
              <div className="flex justify-between text-xs">
                <span className="font-bold" style={{ color: 'var(--text-primary)' }}>Lowest {levelNumber(lo)}</span>
                <span className="font-bold" style={{ color: 'var(--text-primary)' }}>Highest {levelNumber(hi)}</span>
              </div>
              <div className="relative mt-7">
                <div className="absolute left-0 right-0 rounded-full" style={{ top: 10, height: 8, background: 'var(--bg-surface)' }} />
                <div className="absolute rounded-full" style={{ top: 10, height: 8, left: pos(lo), width: `calc((100% - 24px) * ${pct(hi) - pct(lo)})`, background: 'var(--brand-primary)' }} />
                {rating !== null && <span className="absolute text-[10px] font-extrabold whitespace-nowrap" style={{ top: -20, left: pos(rating), transform: 'translateX(-50%)', color: 'var(--brand-primary-text)' }}>You {levelNumber(rating)}</span>}
                <div className="dual-range">
                  <input type="range" aria-label="Lowest level" min={MIN_RATING} max={MAX_RATING} step={0.5} value={lo}
                    onChange={e => { const c = clampRange(Number(e.target.value), Math.max(hi, Number(e.target.value) + 0.5)); onRange(c.min, c.max) }} />
                  <input type="range" aria-label="Highest level" min={MIN_RATING} max={MAX_RATING} step={0.5} value={hi}
                    onChange={e => { const c = clampRange(Math.min(lo, Number(e.target.value) - 0.5), Number(e.target.value)); onRange(c.min, c.max) }} />
                </div>
              </div>
              <div className="text-[11px] mt-1" style={{ color: 'var(--text-subtle)' }}>{describeRange(range)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
