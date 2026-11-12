'use client'

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { pairViews, playerName, type VPlayer } from '@/lib/tournament-view'

const card = { background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' } as const

// Make the partnerships for a pair format: a random draw, balanced by level, or picked by hand.
// The order of the pairs is the seeding, which matters for brackets and groups.
export default function PairsEditor({
  tournamentId, players, usesSeeds, onChanged,
}: { tournamentId: string; players: VPlayer[]; usesSeeds: boolean; onChanged: () => void }) {
  const saved = useMemo(() => pairViews(players).map(p => p.rows.map(r => r.id)), [players])
  const sig = JSON.stringify(saved)
  const [draft, setDraft] = useState<string[][]>(saved)
  const [picked, setPicked] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  useEffect(() => { setDraft(JSON.parse(sig)); setPicked([]) }, [sig])

  const byId = new Map(players.map(p => [p.id, p]))
  const nm = (id: string) => playerName(byId.get(id))
  const inDraft = new Set(draft.flat())
  const loose = players.filter(p => !inDraft.has(p.id))
  const complete = loose.length === 0 && draft.length > 0
  const changed = JSON.stringify(draft) !== sig
  const odd = players.length % 2 === 1

  const call = async (body: Record<string, unknown>, done?: string) => {
    setBusy(true)
    const res = await fetch('/api/tournaments/pairs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tournamentId, ...body }) })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { toast.error(data.error ?? 'Could not save the pairs'); return }
    if (done) toast.success(done)
    onChanged()
  }
  const toggle = (id: string) => setPicked(prev => (prev.includes(id) ? prev.filter(x => x !== id) : prev.length >= 2 ? [prev[1], id] : [...prev, id]))
  const pairUp = () => { if (picked.length === 2) { setDraft(d => [...d, picked]); setPicked([]) } }
  const move = (i: number, dir: -1 | 1) => setDraft(d => { const j = i + dir; if (j < 0 || j >= d.length) return d; const c = [...d]; [c[i], c[j]] = [c[j], c[i]]; return c })

  return (
    <section className="rounded-2xl p-4 space-y-3" style={card} data-testid="pairs-editor">
      <div>
        <h2 className="text-sm font-extrabold uppercase tracking-wide" style={{ color: 'var(--text-primary)' }}>Pairs ({draft.length})</h2>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          {odd ? 'You have an odd number of players, so one has no partner. Add or remove one.' : usesSeeds ? 'The first pair is seed 1 and gets the easiest draw. Move pairs up or down to change the seeding.' : 'Everyone plays every other pair once.'}
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button className="btn btn-sm" disabled={busy || odd || players.length < 4} onClick={() => call({ mode: 'random' }, 'Pairs drawn')} data-testid="pairs-random">Random draw</button>
        <button className="btn btn-sm" disabled={busy || odd || players.length < 4} onClick={() => call({ mode: 'balanced' }, 'Pairs balanced by level')} data-testid="pairs-balanced">Balanced by level</button>
        {(draft.length > 0 || saved.length > 0) && <button className="btn btn-sm" disabled={busy} onClick={() => { setDraft([]); setPicked([]); if (saved.length) call({ mode: 'clear' }) }} data-testid="pairs-clear">Clear</button>}
      </div>

      {draft.length > 0 && (
        <ol className="space-y-1.5" data-testid="pair-list">
          {draft.map((p, i) => (
            <li key={p.join('-')} className="flex items-center gap-2 rounded-lg px-3 py-1.5" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }} data-testid="pair-row">
              <span className="w-5 text-xs font-bold text-center" style={{ color: 'var(--brand-primary-text)' }}>{i + 1}</span>
              <span className="flex-1 text-sm font-medium min-w-0 truncate" style={{ color: 'var(--text-primary)' }}>{nm(p[0])} &amp; {nm(p[1])}</span>
              {usesSeeds && <>
                <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="px-1.5 text-sm disabled:opacity-30" style={{ color: 'var(--text-muted)' }}>▲</button>
                <button type="button" aria-label="Move down" disabled={i === draft.length - 1} onClick={() => move(i, 1)} className="px-1.5 text-sm disabled:opacity-30" style={{ color: 'var(--text-muted)' }}>▼</button>
              </>}
              <button type="button" aria-label="Split this pair" onClick={() => setDraft(d => d.filter((_, k) => k !== i))} style={{ color: 'var(--brand-crimson)' }}>×</button>
            </li>
          ))}
        </ol>
      )}

      {loose.length > 0 && (
        <div>
          <label className="label">Pick two to pair them up ({loose.length} without a partner)</label>
          <div className="flex flex-wrap gap-1.5">
            {loose.map(p => {
              const on = picked.includes(p.id)
              return (
                <button key={p.id} type="button" aria-pressed={on} onClick={() => toggle(p.id)} data-testid="loose-player"
                  className="text-xs font-semibold px-3 py-1.5 rounded-full"
                  style={{ background: on ? 'var(--brand-primary)' : 'var(--bg-raised)', color: on ? 'var(--brand-primary-on)' : 'var(--text-primary)', border: `1px solid ${on ? 'var(--brand-primary)' : 'var(--border)'}` }}>
                  {playerName(p)}
                </button>
              )
            })}
          </div>
          <button className="btn btn-sm mt-2" disabled={picked.length !== 2} onClick={pairUp} data-testid="pair-up">Pair them up</button>
        </div>
      )}

      {changed && (
        <button className="btn btn-primary btn-sm w-full justify-center" disabled={busy || !complete} onClick={() => call({ mode: 'manual', pairs: draft }, 'Pairs saved')} data-testid="pairs-save">
          {complete ? 'Save these pairs' : 'Pair everyone up to save'}
        </button>
      )}
    </section>
  )
}
