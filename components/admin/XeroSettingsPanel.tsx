'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

type Status = {
  configured: boolean
  connected: boolean
  tenantName?: string
  bankAccountId?: string | null
  revenueAccountCode?: string | null
  bankAccounts?: { id: string; name: string }[]
  revenueAccounts?: { code: string; name: string }[]
}

export default function XeroSettingsPanel() {
  const [status, setStatus] = useState<Status | null>(null)
  const [loading, setLoading] = useState(true)
  const [bankAccountId, setBankAccountId] = useState('')
  const [revenueCode, setRevenueCode] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/xero/status')
      const data = await res.json()
      setStatus(data)
      setBankAccountId(data.bankAccountId ?? '')
      setRevenueCode(data.revenueAccountCode ?? '')
    } catch {
      toast.error('Could not load Xero status')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    if (!bankAccountId || !revenueCode) {
      toast.error('Pick a bank account and a revenue account')
      return
    }
    setSaving(true)
    const bankAccount = status?.bankAccounts?.find(a => a.id === bankAccountId)
    const revenueAccount = status?.revenueAccounts?.find(a => a.code === revenueCode)
    const res = await fetch('/api/xero/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bankAccountId,
        bankAccountName: bankAccount?.name,
        revenueAccountCode: revenueCode,
        revenueAccountName: revenueAccount?.name,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      toast.error('Could not save Xero settings')
      return
    }
    toast.success('Xero settings saved — payments will now sync automatically')
    load()
  }

  const disconnect = async () => {
    if (!confirm('Disconnect Xero? Payments will stop syncing until you reconnect.')) return
    const res = await fetch('/api/xero/disconnect', { method: 'POST' })
    if (!res.ok) {
      toast.error('Could not disconnect Xero')
      return
    }
    toast.success('Xero disconnected')
    load()
  }

  if (loading) {
    return (
      <div className="rounded-2xl text-center py-12 text-sm" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
        Loading…
      </div>
    )
  }

  if (!status?.configured) {
    return (
      <div className="rounded-2xl p-5 text-sm" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
        Xero isn't set up on this deployment yet — <code>XERO_CLIENT_ID</code> and <code>XERO_CLIENT_SECRET</code> need to be added as environment variables first.
      </div>
    )
  }

  if (!status.connected) {
    return (
      <div className="rounded-2xl p-6 text-center" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
        <div className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
          Connect Xero to automatically record every paid booking, credit pack, membership and split payment as a bank transaction.
        </div>
        <a href="/api/xero/connect" className="btn btn-primary">Connect Xero</a>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-5 flex items-center justify-between" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
        <div>
          <div className="text-xs mb-1" style={{ color: 'var(--text-subtle)' }}>Connected to</div>
          <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>{status.tenantName}</div>
        </div>
        <button className="btn btn-sm btn-danger" onClick={disconnect}>Disconnect</button>
      </div>

      <div className="rounded-2xl p-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
        <div className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Sync settings</div>
        <label className="label">Bank account payments are recorded against</label>
        <select className="input text-sm" value={bankAccountId} onChange={e => setBankAccountId(e.target.value)}>
          <option value="">— select —</option>
          {(status.bankAccounts ?? []).map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>

        <label className="label mt-3">Revenue account payments are coded to</label>
        <select className="input text-sm" value={revenueCode} onChange={e => setRevenueCode(e.target.value)}>
          <option value="">— select —</option>
          {(status.revenueAccounts ?? []).map(a => (
            <option key={a.code} value={a.code}>{a.name} ({a.code})</option>
          ))}
        </select>

        <button className="btn btn-primary mt-4 w-full justify-center" disabled={saving} onClick={save}>
          {saving ? 'Saving…' : 'Save settings'}
        </button>

        {(!status.bankAccountId || !status.revenueAccountCode) && (
          <div className="text-xs mt-3" style={{ color: 'var(--brand-accent)' }}>
            Payments won't sync until both are set.
          </div>
        )}
      </div>
    </div>
  )
}
