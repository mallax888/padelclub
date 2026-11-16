'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import toast from 'react-hot-toast'
import { AnsweredRow, AskCard, FlowButton, FlowProgress, FLOW_FRAME } from '@/components/ui/PromptFlow'

// Six sample places on a ladder, so "challenge range" can be shown rather than explained.
// A new player is shown at fifth place, with one player below for contrast.
const SAMPLE = ['Ari', 'Jo', 'Mia', 'Alex', null, 'Sam'] as const
const NEW_RANK = 5

export default function NewLadderForm({ organizerId }: { organizerId: string }) {
  const supabase = createClient()
  const router = useRouter()

  const [name, setName] = useState('')
  const [maxChallengeGap, setMaxChallengeGap] = useState(3)
  const [step, setStep] = useState<'name' | 'range'>('name')
  const [saving, setSaving] = useState(false)

  const next = () => {
    if (!name.trim()) { toast.error('Give the ladder a name'); return }
    setStep('range')
  }

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('Give the ladder a name'); setStep('name'); return }

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

  const lowest = Math.max(1, NEW_RANK - maxChallengeGap)

  return (
    <div className={FLOW_FRAME}>
      <FlowProgress total={2} current={step === 'name' ? 1 : 2} />
      <div className="flex flex-col gap-4">
        {step === 'range' && <AnsweredRow id="name" label="Ladder name" value={name.trim()} onChange={() => setStep('name')} />}

        {step === 'name' && (
          <AskCard n={1} total={2} title="What is the ladder called?" subtitle="Players see this name when they join.">
            <input type="text" className="input text-sm" placeholder="Club Ladder" value={name} autoFocus data-testid="ladder-name"
              onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') next() }} />
            <FlowButton onClick={next} testId="flow-continue">Continue</FlowButton>
          </AskCard>
        )}

        {step === 'range' && (
          <AskCard n={2} total={2} title="How far can players challenge?" subtitle="A player can only challenge someone ranked within this many spots above them.">
            <div className="grid grid-cols-5 gap-2.5" role="radiogroup" aria-label="Challenge range" data-testid="challenge-range">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} type="button" role="radio" aria-checked={maxChallengeGap === n} onClick={() => setMaxChallengeGap(n)}
                  className="py-3 rounded-xl text-[15px] font-extrabold transition-all"
                  style={{
                    background: maxChallengeGap === n ? 'var(--brand-primary)' : 'var(--bg-raised)',
                    color: maxChallengeGap === n ? 'var(--brand-primary-on)' : 'var(--text-muted)',
                    border: `1px solid ${maxChallengeGap === n ? 'var(--brand-primary)' : 'var(--border)'}`,
                    boxShadow: maxChallengeGap === n ? 'var(--glow-primary)' : 'none',
                  }}>
                  {n}
                </button>
              ))}
            </div>

            <div className="rounded-2xl overflow-hidden" data-testid="range-preview" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              {SAMPLE.map((who, i) => {
                const rank = i + 1
                const isNew = rank === NEW_RANK
                const canChallenge = rank < NEW_RANK && rank >= lowest
                return (
                  <div key={rank} className="flex items-center gap-3 px-3.5 py-2.5 text-[13px]"
                    style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)', background: isNew ? 'var(--brand-primary-muted)' : 'transparent' }}>
                    <span className="w-6 font-extrabold" style={{ color: 'var(--text-subtle)' }}>{rank}</span>
                    <span className="font-semibold" style={{ color: isNew ? 'var(--brand-primary-text)' : 'var(--text-primary)' }}>{isNew ? 'A new player here' : who}</span>
                    {isNew && (
                      <span className="ml-auto text-[11px] font-semibold text-right" data-testid="range-summary" style={{ color: 'var(--brand-primary-text)' }}>
                        Can challenge {lowest === NEW_RANK - 1 ? `rank ${lowest}` : `ranks ${lowest} to ${NEW_RANK - 1}`}
                      </span>
                    )}
                    {canChallenge && (
                      <span className="ml-auto text-[10.5px] font-extrabold rounded-full px-2.5 py-0.5" style={{ background: 'var(--brand-green-muted, var(--brand-primary-muted))', color: 'var(--brand-green, var(--brand-primary-text))' }}>Can challenge</span>
                    )}
                    {rank > NEW_RANK && <span className="ml-auto text-[11px]" style={{ color: 'var(--text-subtle)' }}>Can challenge rank {NEW_RANK}</span>}
                  </div>
                )
              })}
            </div>
          </AskCard>
        )}

        {step === 'range' && (
          <FlowButton onClick={handleCreate} disabled={saving} testId="create-ladder">{saving ? 'Creating…' : 'Create ladder'}</FlowButton>
        )}
      </div>
    </div>
  )
}
