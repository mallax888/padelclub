'use client'

import Link from 'next/link'

type AdminTab = 'board' | 'analytics' | 'reports' | 'bookings' | 'members' | 'courts' | 'xero'

const ICONS: Record<string, JSX.Element> = {
  board: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M9 4v18"/></svg>,
  bookings: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>,
  members: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  tournaments: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M17 5h3a2 2 0 0 1-2 4M7 5H4a2 2 0 0 0 2 4"/></svg>,
  ladders: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="2" x2="6" y2="22"/><line x1="18" y1="2" x2="18" y2="22"/><line x1="6" y1="7" x2="18" y2="7"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="6" y1="17" x2="18" y2="17"/></svg>,
  analytics: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 15l4-6 4 3 5-8"/></svg>,
  reports: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5M9 13h6M9 17h6"/></svg>,
  courts: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="3.2"/></svg>,
  xero: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M2 12h20"/></svg>,
}

const TAB_ITEMS: { tab: AdminTab; label: string }[] = [
  { tab: 'board', label: 'Dashboard' },
  { tab: 'bookings', label: 'Bookings' },
  { tab: 'members', label: 'Members' },
]

// Tournaments/Ladders already exist as their own full member-facing pages
// (staff manage them there too, see 017_country_scoped_staff.sql's RLS) --
// not duplicated as Admin tabs, just linked out to, same as the reference
// layout's sidebar links out to sections that live elsewhere.
const LINK_ITEMS = [
  { href: '/tournaments', label: 'Tournaments', icon: 'tournaments' },
  { href: '/ladders', label: 'Ladders', icon: 'ladders' },
]

const TAB_ITEMS_2: { tab: AdminTab; label: string }[] = [
  { tab: 'analytics', label: 'Analytics' },
  { tab: 'reports', label: 'Reports' },
  { tab: 'courts', label: 'Courts' },
  { tab: 'xero', label: 'Xero' },
]

export default function AdminSidebar({
  tab,
  setTab,
  venueName,
  venueRegion,
  staffName,
}: {
  tab: AdminTab
  setTab: (t: AdminTab) => void
  venueName: string
  venueRegion: string
  staffName: string | null
}) {
  const NavButton = ({ item }: { item: { tab: AdminTab; label: string } }) => (
    <button
      onClick={() => setTab(item.tab)}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-colors"
      style={{
        background: tab === item.tab ? 'var(--brand-primary-muted)' : 'transparent',
        color: tab === item.tab ? 'var(--brand-primary-text)' : 'var(--text-muted)',
      }}
    >
      <span style={{ width: 18, height: 18, flexShrink: 0 }}>{ICONS[item.tab]}</span>
      {item.label}
    </button>
  )

  return (
    <div className="hidden md:flex flex-col justify-between shrink-0" style={{ width: 200 }}>
      <div className="space-y-1">
        {TAB_ITEMS.map(item => <NavButton key={item.tab} item={item} />)}
        <div className="my-2" style={{ borderTop: '1px solid var(--border)' }} />
        {LINK_ITEMS.map(item => (
          <Link key={item.href} href={item.href}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors"
            style={{ color: 'var(--text-muted)' }}>
            <span style={{ width: 18, height: 18, flexShrink: 0 }}>{ICONS[item.icon]}</span>
            {item.label}
          </Link>
        ))}
        <div className="my-2" style={{ borderTop: '1px solid var(--border)' }} />
        {TAB_ITEMS_2.map(item => <NavButton key={item.tab} item={item} />)}
      </div>

      <div className="rounded-xl p-3 mt-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <div className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{venueName}</div>
        <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-subtle)' }}>{venueRegion}</div>
        {staffName && (
          <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: 'var(--brand-primary)', color: 'var(--brand-primary-on)' }}>
              {staffName.slice(0, 1).toUpperCase()}
            </div>
            <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{staffName}</div>
          </div>
        )}
      </div>
    </div>
  )
}
