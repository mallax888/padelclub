'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import toast from 'react-hot-toast'

type PasskeyItem = { id: string; friendly_name?: string; created_at: string }

// PasskeyItem.created_at is a full ISO timestamp (unlike booking dates
// elsewhere in the app, which are bare yyyy-mm-dd) -- lib/utils' formatDate
// assumes the latter, so this formats the passkey list's own dates locally.
function formatPasskeyDate(isoStr: string): string {
  return new Intl.DateTimeFormat('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(isoStr))
}

function deviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Passkey'
  const ua = navigator.userAgent
  if (/iphone/i.test(ua)) return 'iPhone'
  if (/ipad/i.test(ua)) return 'iPad'
  if (/android/i.test(ua)) return 'Android device'
  if (/macintosh/i.test(ua)) return 'Mac'
  if (/windows/i.test(ua)) return 'Windows PC'
  return 'Passkey'
}

export default function PasskeySetup() {
  const supabase = createClient()
  const [passkeys, setPasskeys] = useState<PasskeyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState(false)
  const supported = typeof window !== 'undefined' && !!window.PublicKeyCredential

  const refresh = async () => {
    const { data, error } = await supabase.auth.passkey.list()
    if (!error) setPasskeys(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    if (supported) refresh()
    else setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!supported) return null

  const handleRegister = async () => {
    setRegistering(true)
    const { data, error } = await supabase.auth.registerPasskey()
    if (error) {
      if (error.name !== 'NotAllowedError' && error.name !== 'AbortError') {
        toast.error(error.message || 'Could not set up fingerprint sign-in')
      }
      setRegistering(false)
      return
    }
    if (data?.id) {
      await supabase.auth.passkey.update({ passkeyId: data.id, friendlyName: deviceLabel() })
    }
    toast.success('Fingerprint sign-in is set up!')
    setRegistering(false)
    refresh()
  }

  const handleDelete = async (passkeyId: string) => {
    const { error } = await supabase.auth.passkey.delete({ passkeyId })
    if (error) {
      toast.error('Could not remove passkey')
      return
    }
    toast.success('Passkey removed')
    setPasskeys(prev => prev.filter(p => p.id !== passkeyId))
  }

  return (
    <div className="mt-3">
      <div className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--text-subtle)' }}>
        Fingerprint sign-in
      </div>

      {!loading && passkeys.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {passkeys.map(p => (
            <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-lg"
              style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
              <div>
                <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                  {p.friendly_name || 'Passkey'}
                </div>
                <div className="text-[10px]" style={{ color: 'var(--text-subtle)' }}>
                  Added {formatPasskeyDate(p.created_at)}
                </div>
              </div>
              <button
                onClick={() => handleDelete(p.id)}
                className="text-xs px-2 py-1 rounded-md"
                style={{ color: 'var(--brand-accent)' }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={handleRegister}
        disabled={registering}
        className="text-xs px-3 py-1.5 rounded-lg transition-all"
        style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
      >
        {registering ? 'Follow the prompt…' : '🔒 Add fingerprint sign-in for this device'}
      </button>
    </div>
  )
}
