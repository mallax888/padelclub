'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import toast from 'react-hot-toast'

export default function NewLadderForm({ organizerId }: { organizerId: string }) {
  const supabase = createClient()
  const router = useRouter()

  const [name, setName] = useState('')
  const [maxChallengeGap, setMaxChallengeGap] = useState(3)
  const [saving, setSaving] = useState(false)

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('Give the ladder a name'); return }

    setSaving(true)
    const { data: ladder, error } = await supabase
      .from('ladders')
      .insert({
        name: name.trim(),
        max_challenge_gap: maxChallengeGap,
        organizer_id: organizerId,
      })
      .select('id')
      .single()

    if (error || !ladder) {
      toast.error('Could not create ladder — please try again')
      setSaving(false)
      return
    }

    toast.success('Ladder created!')
    router.push(`/ladders/${ladder.id}`)
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="rounded-2xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
        <label className="label">Ladder name</label>
        <input type="text" className="input text-sm" placeholder="Club Ladder" value={name} onChange={e => setName(e.target.value)} />

        <label className="label mt-3">Challenge range</label>
        <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Players can only challenge someone ranked within this many spots above them</p>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} type="button" onClick={() => setMaxChallengeGap(n)}
              className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: maxChallengeGap === n ? 'var(--brand-primary)' : 'var(--bg-raised)',
                color: maxChallengeGap === n ? 'var(--brand-primary-on)' : 'var(--text-muted)',
                boxShadow: maxChallengeGap === n ? 'var(--glow-primary)' : 'none',
              }}>
              {n}
            </button>
          ))}
        </div>
      </div>

      <button type="button" onClick={handleCreate} disabled={saving} className="btn btn-primary w-full justify-center">
        {saving ? 'Creating…' : 'Create ladder'}
      </button>
    </div>
  )
}
