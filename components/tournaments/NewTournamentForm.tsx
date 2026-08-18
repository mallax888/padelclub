'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import toast from 'react-hot-toast'
import { VENUES } from '@/lib/venues'
import { localDateStr } from '@/lib/utils'

type Player = { id: string; full_name: string | null; nickname: string | null }

export default function NewTournamentForm({ players, organizerId }: { players: Player[]; organizerId: string }) {
  const supabase = createClient()
  const router = useRouter()

  const [name, setName] = useState('')
  const [venueSlug, setVenueSlug] = useState('')
  const [date, setDate] = useState(localDateStr(new Date(Date.now() + 24 * 60 * 60 * 1000)))
  const [selectedCourts, setSelectedCourts] = useState<string[]>([])
  const [pointsToWin, setPointsToWin] = useState(21)
  const [totalRounds, setTotalRounds] = useState(8)
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const venuesByRegion = useMemo(() => {
    const byRegion: Record<string, typeof VENUES> = {}
    VENUES.forEach(v => {
      byRegion[v.region] = byRegion[v.region] ?? []
      byRegion[v.region].push(v)
    })
    return byRegion
  }, [])

  const venue = VENUES.find(v => v.slug === venueSlug)

  const toggleCourt = (id: string) => {
    setSelectedCourts(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  }
  const togglePlayer = (id: string) => {
    setSelectedPlayers(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])
  }

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('Give the tournament a name'); return }
    if (!venueSlug) { toast.error('Pick a venue'); return }
    if (selectedCourts.length === 0) { toast.error('Select at least one court'); return }
    if (selectedPlayers.length < 4) { toast.error('Add at least 4 players'); return }

    setSaving(true)
    const { data: tournament, error } = await supabase
      .from('tournaments')
      .insert({
        name: name.trim(),
        venue_slug: venueSlug,
        date,
        court_ids: selectedCourts,
        points_to_win: pointsToWin,
        total_rounds: totalRounds,
        organizer_id: organizerId,
      })
      .select('id')
      .single()

    if (error || !tournament) {
      toast.error('Could not create tournament — please try again')
      setSaving(false)
      return
    }

    const { error: playersError } = await supabase
      .from('tournament_players')
      .insert(selectedPlayers.map(playerId => ({ tournament_id: tournament.id, player_id: playerId })))

    if (playersError) {
      toast.error('Tournament created, but adding players failed — add them from the tournament page')
    } else {
      toast.success('Tournament created!')
    }
    router.push(`/tournaments/${tournament.id}`)
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <label className="label">Tournament name</label>
        <input type="text" className="input text-sm" placeholder="Saturday Americano" value={name} onChange={e => setName(e.target.value)} />

        <label className="label mt-3">Date</label>
        <input type="date" className="input text-sm" value={date} onChange={e => setDate(e.target.value)} />

        <label className="label mt-3">Venue</label>
        <select className="input text-sm" value={venueSlug} onChange={e => { setVenueSlug(e.target.value); setSelectedCourts([]) }}>
          <option value="">— select —</option>
          {Object.entries(venuesByRegion).map(([region, venues]) => (
            <optgroup key={region} label={region}>
              {venues.map(v => <option key={v.slug} value={v.slug}>{v.name}</option>)}
            </optgroup>
          ))}
        </select>

        {venue && (
          <>
            <label className="label mt-3">Courts</label>
            <div className="flex flex-wrap gap-1.5">
              {venue.courts.map(c => (
                <button key={c.id} type="button" onClick={() => toggleCourt(c.id)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full transition-colors"
                  style={{
                    background: selectedCourts.includes(c.id) ? 'var(--brand-primary)' : 'var(--bg-raised)',
                    color: selectedCourts.includes(c.id) ? 'var(--brand-primary-on)' : 'var(--text-muted)',
                    border: `1px solid ${selectedCourts.includes(c.id) ? 'var(--brand-primary)' : 'var(--border)'}`,
                  }}>
                  {c.name}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className="label">Points to win</label>
            <input type="number" min={1} className="input text-sm" value={pointsToWin} onChange={e => setPointsToWin(Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Total rounds</label>
            <input type="number" min={1} className="input text-sm" value={totalRounds} onChange={e => setTotalRounds(Number(e.target.value))} />
          </div>
        </div>
      </div>

      <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <label className="label">Players ({selectedPlayers.length} selected)</label>
        <div className="max-h-60 overflow-y-auto space-y-1.5 mt-1.5">
          {players.map(p => (
            <button key={p.id} type="button" onClick={() => togglePlayer(p.id)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all"
              style={{
                background: selectedPlayers.includes(p.id) ? 'var(--brand-primary-muted)' : 'var(--bg-raised)',
                border: `1px solid ${selectedPlayers.includes(p.id) ? 'var(--brand-primary)' : 'var(--border)'}`,
              }}>
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{p.nickname ?? p.full_name}</span>
              {selectedPlayers.includes(p.id) && <span style={{ color: 'var(--brand-primary)' }}>✓</span>}
            </button>
          ))}
        </div>
      </div>

      <button className="btn btn-primary w-full justify-center py-3" disabled={saving} onClick={handleCreate}>
        {saving ? 'Creating…' : 'Create tournament'}
      </button>
    </div>
  )
}
