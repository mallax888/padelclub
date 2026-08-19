'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import toast from 'react-hot-toast'
import { SKILL_LEVELS, type SkillLevel } from '@/lib/skill-levels'
import { VENUES } from '@/lib/venues'

type Step = 'nickname' | 'skill' | 'venue'
const STEPS: Step[] = ['nickname', 'skill', 'venue']

export default function OnboardingFlow({
  userId,
  defaultName,
}: {
  userId: string
  defaultName: string
}) {
  const supabase = createClient()
  const router = useRouter()
  const [step, setStep] = useState<Step>('nickname')
  const [nickname, setNickname] = useState(defaultName.split(' ')[0] ?? '')
  const [skillLevel, setSkillLevel] = useState<SkillLevel | null>(null)
  const [homeVenueSlug, setHomeVenueSlug] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const venuesByRegion = useMemo(() => {
    const byRegion: Record<string, typeof VENUES> = {}
    VENUES.forEach(v => {
      byRegion[v.region] = byRegion[v.region] ?? []
      byRegion[v.region].push(v)
    })
    return byRegion
  }, [])

  const stepIndex = STEPS.indexOf(step)

  const finish = async (venueOverride: string | null = homeVenueSlug) => {
    setSaving(true)
    const level = skillLevel ? SKILL_LEVELS.find(l => l.value === skillLevel) : null
    const { error } = await supabase
      .from('profiles')
      .update({
        nickname: nickname.trim() || null,
        skill_level: skillLevel,
        skill_rating: level?.rating ?? null,
        home_venue_slug: venueOverride,
        onboarding_completed: true,
      })
      .eq('id', userId)

    if (error) {
      toast.error('Could not save — please try again.')
      setSaving(false)
      return
    }
    router.push('/book')
    router.refresh()
  }

  const goNext = () => {
    const idx = STEPS.indexOf(step)
    if (idx < STEPS.length - 1) {
      setStep(STEPS[idx + 1])
    } else {
      finish()
    }
  }

  const goBack = () => {
    const idx = STEPS.indexOf(step)
    if (idx > 0) setStep(STEPS[idx - 1])
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-base)' }}>
      <div className="w-full max-w-md">
        <div className="flex gap-1.5 mb-6">
          {STEPS.map((s, i) => (
            <div key={s} className="h-1.5 flex-1 rounded-full" style={{ background: i <= stepIndex ? 'var(--brand-primary)' : 'var(--border)' }} />
          ))}
        </div>

        <div className="rounded-2xl p-6" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
          {step === 'nickname' && (
            <>
              <div className="text-2xl mb-2">🎾</div>
              <h1 className="text-xl font-extrabold mb-1" style={{ color: 'var(--text-primary)' }}>Welcome to PadelClub</h1>
              <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>What should other players call you?</p>
              <input
                type="text"
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                placeholder="Nickname"
                autoFocus
                className="input w-full"
              />
            </>
          )}

          {step === 'skill' && (
            <>
              <h1 className="text-xl font-extrabold mb-1" style={{ color: 'var(--text-primary)' }}>What's your skill level?</h1>
              <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>Helps us match you with the right players. You can change this anytime.</p>
              <div className="space-y-1.5">
                {SKILL_LEVELS.map(level => (
                  <button
                    key={level.value}
                    type="button"
                    onClick={() => setSkillLevel(level.value)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-all"
                    style={{
                      background: skillLevel === level.value ? 'var(--brand-primary-muted)' : 'var(--bg-raised)',
                      border: `1px solid ${skillLevel === level.value ? 'var(--brand-primary)' : 'var(--border)'}`,
                    }}
                  >
                    <div>
                      <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{level.label}</div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{level.desc}</div>
                    </div>
                    {skillLevel === level.value && <span style={{ color: 'var(--brand-primary)' }}>✓</span>}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 'venue' && (
            <>
              <h1 className="text-xl font-extrabold mb-1" style={{ color: 'var(--text-primary)' }}>Pick your home venue</h1>
              <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>We'll use this as your starting point when booking. Optional — skip if you play at different courts.</p>
              <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
                {Object.entries(venuesByRegion).map(([region, venues]) => (
                  <div key={region}>
                    <div className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-muted)' }}>{region}</div>
                    <div className="space-y-1.5">
                      {venues.map(v => (
                        <button
                          key={v.slug}
                          type="button"
                          onClick={() => setHomeVenueSlug(homeVenueSlug === v.slug ? null : v.slug)}
                          className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-all"
                          style={{
                            background: homeVenueSlug === v.slug ? 'var(--brand-primary-muted)' : 'var(--bg-raised)',
                            border: `1px solid ${homeVenueSlug === v.slug ? 'var(--brand-primary)' : 'var(--border)'}`,
                          }}
                        >
                          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{v.name}</span>
                          {homeVenueSlug === v.slug && <span style={{ color: 'var(--brand-primary)' }}>✓</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="flex gap-2 mt-6">
            {stepIndex > 0 && (
              <button type="button" onClick={goBack} className="btn btn-sm" disabled={saving}>Back</button>
            )}
            <button type="button" onClick={goNext} className="btn btn-primary flex-1 justify-center" disabled={saving}>
              {saving ? 'Saving…' : stepIndex === STEPS.length - 1 ? "Let's play" : 'Continue'}
            </button>
          </div>
          {step === 'venue' && (
            <button
              type="button"
              onClick={() => finish(null)}
              disabled={saving}
              className="w-full text-center text-xs font-semibold mt-3"
              style={{ color: 'var(--text-muted)' }}
            >
              Skip — I play at different courts
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
