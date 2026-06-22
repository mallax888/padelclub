'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

const SKILL_LEVELS = [
  { value: 'beginner',     label: 'Beginner',     desc: 'Just starting out',            rating: 1.0 },
  { value: 'improver',     label: 'Improver',     desc: 'Getting the basics down',       rating: 2.0 },
  { value: 'intermediate', label: 'Intermediate', desc: 'Comfortable rallying',          rating: 3.0 },
  { value: 'advanced',     label: 'Advanced',     desc: 'Consistent & competitive',      rating: 4.5 },
  { value: 'elite',        label: 'Elite',        desc: 'Tournament level',              rating: 6.0 },
]

export default function SkillEditor({
  userId,
  currentSkillLevel,
}: {
  userId: string
  currentSkillLevel: string | null
}) {
  const supabase = createClient()
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [selected, setSelected] = useState(currentSkillLevel ?? 'beginner')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const level = SKILL_LEVELS.find(l => l.value === selected)
    const { error } = await (supabase as any)
      .from('profiles')
      .update({
        skill_level: selected,
        skill_rating: level?.rating ?? 1.0,
      })
      .eq('id', userId)

    if (error) {
      toast.error('Could not save skill level')
    } else {
      toast.success('Skill level updated!')
      setEditing(false)
      router.refresh()
    }
    setSaving(false)
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-xs px-3 py-1.5 rounded-lg transition-all mt-2"
        style={{
          background: 'var(--bg-raised)',
          border: '1px solid var(--border)',
          color: 'var(--text-muted)',
        }}
      >
        ✏️ Edit skill level
      </button>
    )
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="text-xs font-medium uppercase tracking-wide mb-2"
        style={{ color: 'var(--text-subtle)' }}>
        Select your skill level
      </div>
      <div className="grid grid-cols-1 gap-1.5">
        {SKILL_LEVELS.map(level => (
          <button
            key={level.value}
            onClick={() => setSelected(level.value)}
            className="flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all"
            style={{
              background: selected === level.value ? 'var(--brand-primary-muted)' : 'var(--bg-raised)',
              border: `1px solid ${selected === level.value ? 'var(--brand-primary)' : 'var(--border)'}`,
              boxShadow: selected === level.value ? 'var(--glow-primary)' : 'none',
            }}
          >
            <div>
              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {level.label}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                {level.desc}
              </div>
            </div>
            {selected === level.value && (
              <span className="text-xs font-medium" style={{ color: 'var(--brand-primary)' }}>✓</span>
            )}
          </button>
        ))}
      </div>
      <div className="flex gap-2 mt-2">
        <button className="btn btn-primary btn-sm flex-1 justify-center"
          disabled={saving} onClick={handleSave}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button className="btn btn-sm" onClick={() => setEditing(false)}>
          Cancel
        </button>
      </div>
    </div>
  )
}
