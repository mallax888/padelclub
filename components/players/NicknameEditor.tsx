'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export default function NicknameEditor({
  userId,
  currentNickname,
}: {
  userId: string
  currentNickname: string | null
}) {
  const supabase = createClient()
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [nickname, setNickname] = useState(currentNickname ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (nickname.length > 20) {
      toast.error('Nickname must be 20 characters or less')
      return
    }
    setSaving(true)
    const { error } = await (supabase as any)
      .from('profiles')
      .update({ nickname: nickname.trim() || null })
      .eq('id', userId)

    if (error) {
      toast.error('Could not save nickname')
    } else {
      toast.success('Nickname updated!')
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
        {currentNickname ? '✏️ Edit nickname' : '+ Set a nickname'}
      </button>
    )
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      <input
        type="text"
        className="input text-sm"
        placeholder="e.g. The Ace, Smash King..."
        value={nickname}
        onChange={e => setNickname(e.target.value)}
        maxLength={20}
        autoFocus
        style={{ maxWidth: 220 }}
      />
      <button
        className="btn btn-primary btn-sm"
        disabled={saving}
        onClick={handleSave}
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
      <button
        className="btn btn-sm"
        onClick={() => { setEditing(false); setNickname(currentNickname ?? '') }}
      >
        Cancel
      </button>
    </div>
  )
}
