'use client'

import { useState, useEffect, useLayoutEffect, useRef, useId } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

type Notification = {
  id: string
  type: string
  message: string
  read: boolean
  created_at: string
}

export default function NotificationBell({ userId, panelPosition = 'top-right' }: { userId: string; panelPosition?: 'top-right' | 'flyout' }) {
  const supabase = createClient()
  const router = useRouter()
  const channelId = useId()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const [flyoutCoords, setFlyoutCoords] = useState<{ left: number; bottom: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const unread = notifications.filter(n => !n.read).length
  const hasRead = notifications.some(n => n.read)

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)
    if (data) setNotifications(data)
  }

  useEffect(() => {
    fetchNotifications()

    // Real-time subscription — channel name must be unique per mounted instance:
    // the sidebar layout can render this component twice at once (mobile bar +
    // desktop sidebar, swapped via CSS not unmounting), and Supabase's browser
    // client is a singleton that reuses any existing channel with the same name,
    // so a shared name throws when the second instance tries to attach its listener.
    const channel = supabase
      .channel(`notifications:${channelId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, () => fetchNotifications())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (ref.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // The sidebar is a vertical-scroll container, which per the CSS spec forces
  // it to clip horizontally too — an inline flyout panel would get cut off and
  // scrollable instead of floating over the page. Portal it to <body> and
  // position it with fixed coordinates (anchored past the sidebar's right
  // edge) so it escapes that clipping entirely.
  useLayoutEffect(() => {
    if (!open || panelPosition !== 'flyout' || !ref.current) {
      setFlyoutCoords(null)
      return
    }
    const buttonRect = ref.current.getBoundingClientRect()
    const asideRect = ref.current.closest('aside')?.getBoundingClientRect()
    setFlyoutCoords({
      left: (asideRect?.right ?? buttonRect.right) + 8,
      bottom: window.innerHeight - buttonRect.bottom,
    })
  }, [open, panelPosition])

  const markAllRead = async () => {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const markRead = async (id: string) => {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const deleteNotification = async (id: string) => {
    // With RLS enabled but no DELETE policy, Postgres silently deletes zero
    // rows instead of erroring -- .select() lets us tell "deleted" apart from
    // "blocked" so the UI doesn't optimistically clear a row that's still
    // sitting in the database (it would just reappear on next fetch).
    const { data, error } = await supabase.from('notifications').delete().eq('id', id).select('id')
    if (error || !data || data.length === 0) {
      toast.error('Could not delete notification')
      return
    }
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const clearRead = async () => {
    const { data, error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId)
      .eq('read', true)
      .select('id')
    if (error) {
      toast.error('Could not clear notifications')
      return
    }
    const deletedIds = new Set((data ?? []).map(n => n.id))
    setNotifications(prev => prev.filter(n => !deletedIds.has(n.id)))
  }

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(mins / 60)
    const days = Math.floor(hours / 24)
    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    if (mins > 0) return `${mins}m ago`
    return 'just now'
  }

  const iconForType = (type: string) => {
    if (type === 'join_request') return '🎾'
    if (type === 'join_accepted') return '✅'
    if (type === 'join_declined') return '❌'
    if (type === 'match_full') return '🔥'
    if (type === 'booking_rescheduled') return '📅'
    return '🔔'
  }

  const panelContent = (
    <>
      <div className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-raised)' }}>
        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Notifications
        </span>
        <div className="flex items-center gap-3">
          {unread > 0 && (
            <button onClick={markAllRead} className="text-xs" style={{ color: 'var(--brand-primary-text)' }}>
              Mark all read
            </button>
          )}
          {hasRead && (
            <button onClick={clearRead} className="text-xs font-medium" style={{ color: 'var(--brand-crimson)' }}>
              Clear read
            </button>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-subtle)' }}>
          No notifications yet
        </div>
      ) : (
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          {notifications.map(n => (
            <div key={n.id}
              onClick={() => { markRead(n.id); router.push('/find-a-game') }}
              className="flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors"
              style={{
                borderBottom: '1px solid var(--border)',
                background: n.read ? 'transparent' : 'var(--brand-primary-muted)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-raised)')}
              onMouseLeave={e => (e.currentTarget.style.background = n.read ? 'transparent' : 'var(--brand-primary-muted)')}
            >
              <span className="text-lg shrink-0">{iconForType(n.type)}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs" style={{ color: 'var(--text-primary)' }}>{n.message}</div>
                <div className="text-[10px] mt-1" style={{ color: 'var(--text-subtle)' }}>
                  {timeAgo(n.created_at)}
                </div>
              </div>
              {!n.read && (
                <div className="w-2 h-2 rounded-full shrink-0 mt-1.5"
                  style={{ background: 'var(--brand-primary)' }} />
              )}
              <button
                onClick={e => { e.stopPropagation(); deleteNotification(n.id) }}
                aria-label="Delete notification"
                className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors"
                style={{ color: 'var(--text-muted)', background: 'var(--bg-base)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--brand-crimson-muted)'; e.currentTarget.style.color = 'var(--brand-crimson)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-base)'; e.currentTarget.style.color = 'var(--text-muted)' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  )

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(!open); if (!open && unread > 0) markAllRead() }}
        className="relative w-9 h-9 rounded-full flex items-center justify-center transition-all"
        style={{
          background: open ? 'var(--bg-raised)' : 'transparent',
          color: 'var(--text-muted)',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unread > 0 && (
          <div className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold"
            style={{ background: 'var(--brand-accent)', color: '#fff' }}>
            {unread > 9 ? '9+' : unread}
          </div>
        )}
      </button>

      {open && panelPosition === 'top-right' && (
        <div ref={panelRef} className="absolute z-50 w-80 rounded-xl shadow-xl overflow-hidden right-0 top-11"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          {panelContent}
        </div>
      )}

      {open && panelPosition === 'flyout' && flyoutCoords && createPortal(
        <div ref={panelRef} className="fixed z-50 w-80 rounded-xl shadow-xl overflow-hidden"
          style={{ left: flyoutCoords.left, bottom: flyoutCoords.bottom, background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          {panelContent}
        </div>,
        document.body,
      )}
    </div>
  )
}
