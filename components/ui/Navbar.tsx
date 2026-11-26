'use client'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from './AuthProvider'
import { getInitials, cn } from '@/lib/utils'
import ThemeToggle from '@/components/ThemeToggle'
import PushNotificationToggle from '@/components/ui/PushNotificationToggle'
import NotificationBell from '@/components/ui/NotificationBell'
import SpecialsMenu from '@/components/ui/SpecialsMenu'
import { SPECIALS, cadencePill } from '@/lib/specials'
import { useEffect, useRef, useState } from 'react'
import ViewSwitch from '@/components/ui/ViewSwitch'
import { homePathFor, roleLabel, type ViewMode } from '@/lib/view-mode'
import { tierLabel } from '@/lib/plan-rules'

const ICONS: Record<string, JSX.Element> = {
  '/book': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>
  ),
  '/home': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg>
  ),
  '/find-a-game': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
  ),
  '/mybookings': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
  ),
  '/membership': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
  ),
  '/players': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  ),
  '/record-match': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M17 5h3a2 2 0 0 1-2 4M7 5H4a2 2 0 0 0 2 4"/></svg>
  ),
  '/admin': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 4 6v6c0 5 3.4 8.4 8 10 4.6-1.6 8-5 8-10V6l-8-4z"/></svg>
  ),
  '/admin/today': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
  ),
  '/admin?tab=board': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M3 9h18"/></svg>
  ),
  '/admin?tab=bookings': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>
  ),
  '/admin/setup': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>
  ),
  '/admin/team': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>
  ),
  '/admin?tab=members': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  ),
  '/admin?tab=analytics': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m7 15 4-5 3 3 5-7"/></svg>
  ),
  '/tournaments': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M17 5h3a2 2 0 0 1-2 4M7 5H4a2 2 0 0 0 2 4"/><circle cx="12" cy="9" r="2.2"/></svg>
  ),
  '/ladders': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="2" x2="6" y2="22"/><line x1="18" y1="2" x2="18" y2="22"/><line x1="6" y1="7" x2="18" y2="7"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="6" y1="17" x2="18" y2="17"/></svg>
  ),
}

// Ordered by how often a member opens them, not by the order the journey
// happens in. "What have I got on this week" is the weekly habit; Open play
// is occasional discovery, so My bookings sits above it.
const NAV_ITEMS = [
  { href: '/home',        label: 'Home' },
  { href: '/book',        label: 'Book a court' },
  { href: '/mybookings',  label: 'My bookings' },
  { href: '/find-a-game', label: 'Open play' },
  { href: '/membership',  label: 'Membership' },
  { href: '/players',      label: 'Players' },
  { href: '/record-match', label: 'Record match' },
  { href: '/tournaments',  label: 'Tournaments' },
  { href: '/ladders',      label: 'Ladders' },
]

// The 4 most-used destinations get a permanent slot in the mobile bottom
// tab bar; everything else (Membership, Players, Record match, Admin,
// sign out) lives behind "More", which opens the existing full menu panel.
const TAB_BAR_ITEMS = [
  { href: '/home',        label: 'Home' },
  { href: '/book',        label: 'Book' },
  { href: '/mybookings',  label: 'Bookings' },
  { href: '/find-a-game', label: 'Open play' },
]

// The manager side: Today first, then the dashboard's busiest tabs. Everything
// else the dashboard has (Members, Reports, Courts, Xero) sits behind More.
// Owners get Analytics in the bar and the money/settings tabs under More. Front
// desk gets Members in the bar and nothing under More but the club competitions.
const OWNER_TAB_ITEMS = [
  { href: '/admin/today',          label: 'Today',     tab: null },
  { href: '/admin?tab=board',      label: 'Board',     tab: 'board' },
  { href: '/admin?tab=bookings',   label: 'Bookings',  tab: 'bookings' },
  { href: '/admin?tab=analytics',  label: 'Analytics', tab: 'analytics' },
]
const DESK_TAB_ITEMS = [
  { href: '/admin/today',          label: 'Today',     tab: null },
  { href: '/admin?tab=board',      label: 'Board',     tab: 'board' },
  { href: '/admin?tab=bookings',   label: 'Bookings',  tab: 'bookings' },
  { href: '/admin?tab=members',    label: 'Members',   tab: 'members' },
]
const OWNER_MORE_ITEMS = [
  { href: '/admin?tab=members',  label: 'Members',  tab: 'members' },
  { href: '/admin?tab=reports',  label: 'Reports',  tab: 'reports' },
  { href: '/admin?tab=courts',   label: 'Courts',   tab: 'courts' },
  { href: '/admin?tab=xero',     label: 'Xero',     tab: 'xero' },
]
// Owners only: the settings an owner changes now and then, kept apart from the daily pages.
const OWNER_MANAGE_ITEMS: { href: string; label: string; tab: string | null }[] = [
  { href: '/admin/team',         label: 'Team',          tab: null },
  { href: '/admin/setup',        label: 'Club settings', tab: null },
]
const MANAGER_CLUB_ITEMS = NAV_ITEMS.filter(i => ['/players', '/tournaments', '/ladders'].includes(i.href))

// Primary items get their own row at the top of the sidebar; the rest sit
// under a "Club" group label. A sidebar has room to show everything at
// once, unlike the old horizontal bar, so there's no overflow menu to manage.
const PRIMARY_NAV_ITEMS = NAV_ITEMS.filter(i => ['/home', '/book', '/find-a-game', '/mybookings'].includes(i.href))
const CLUB_NAV_ITEMS = NAV_ITEMS.filter(i => !['/home', '/book', '/find-a-game', '/mybookings'].includes(i.href))

function SidebarLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    // The page you are on is a white pill (dark words); every page has its icon in a soft rounded tile.
    <Link href={href} aria-current={active ? 'page' : undefined}
      className="flex items-center gap-2.5 px-1.5 py-1.5 rounded-[14px] text-[13.5px] transition-colors relative"
      style={{
        background: active ? 'var(--today-block-bg)' : 'transparent',
        color: active ? 'var(--today-block-fg)' : 'var(--text-primary)',
        boxShadow: active ? 'var(--today-block-shadow)' : undefined,
        fontWeight: active ? 800 : 600,
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-raised)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
    >
      <span className="inline-flex items-center justify-center shrink-0 rounded-[10px]" style={{ width: 30, height: 30, background: active ? '#0f151c' : 'var(--bg-raised)', color: active ? '#ffffff' : 'var(--text-muted)' }}>
        <span style={{ width: 16, height: 16, display: 'inline-flex' }}>{ICONS[href]}</span>
      </span>
      {label}
    </Link>
  )
}

// You, at the bottom of the sidebar. The dots open a small menu: phone alerts and Sign out (red, last, so it is hard to hit by mistake).
function ProfileCard({ initials, name, who, onSignOut }: { initials: string; name: string; who: string; onSignOut: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', away); window.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', away); window.removeEventListener('keydown', esc) }
  }, [open])
  return (
    <div ref={ref} className="relative mt-3" data-testid="profile-card">
      {open && (
        <div role="menu" className="absolute left-0 right-0 bottom-full mb-2 rounded-[16px] p-2 z-50" data-testid="profile-menu"
          style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', boxShadow: '0 18px 40px rgba(0,0,0,0.45)' }}>
          <PushNotificationToggle variant="row" />
          <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />
          <button type="button" role="menuitem" onClick={onSignOut} className="flex items-center gap-2.5 w-full px-2 py-2.5 rounded-[10px] text-[13.5px] font-extrabold whitespace-nowrap" style={{ color: 'var(--brand-crimson)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 16l-4-4 4-4M6 12h10"/></svg>
            Sign out
          </button>
        </div>
      )}
      <button type="button" onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="Your account"
        className="flex items-center gap-2.5 w-full p-2 rounded-[16px] text-left" style={{ background: open ? 'var(--bg-raised)' : 'transparent', border: '1px solid var(--border)' }}>
        <span className="inline-flex items-center justify-center shrink-0 font-extrabold text-white" style={{ width: 34, height: 34, borderRadius: 11, fontSize: 11.5, background: 'linear-gradient(160deg,#3a73dc,#1d3f8d)' }}>{initials}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-bold truncate" style={{ color: 'var(--text-primary)' }}>{name}</span>
          <span className="inline-block text-[10.5px] font-extrabold capitalize rounded-full px-2 mt-0.5" style={{ background: 'rgba(156,194,255,0.14)', color: 'var(--label-blue)' }}>{who}</span>
        </span>
        <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: 'var(--text-muted)', flexShrink: 0 }}><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>
      </button>
    </div>
  )
}

function TabBarLink({ href, label, active, icon, onClick }: { href: string; label: string; active: boolean; icon?: JSX.Element; onClick?: (e: React.MouseEvent) => void }) {
  return (
    <Link href={href} onClick={onClick} className="flex items-center justify-center transition-all" style={{
      flexDirection: 'column',
      gap: 2,
      padding: '6px 12px',
      minWidth: 58,
      borderRadius: 14,
      background: active ? 'var(--brand-primary)' : 'transparent',
    }}>
      <span style={{ width: 16, height: 16, flexShrink: 0, color: active ? 'var(--brand-primary-on)' : 'var(--text-subtle)' }}>{icon ?? ICONS[href]}</span>
      <span className="whitespace-nowrap" style={{
        fontSize: 10,
        fontWeight: 700,
        color: active ? 'var(--brand-primary-on)' : 'var(--text-subtle)',
      }}>{label}</span>
    </Link>
  )
}

function SidebarGroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2.5 pt-5 pb-1.5 text-[10.5px] font-extrabold uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '0.14em' }}>
      {children}
    </div>
  )
}

export default function Navbar({ viewMode = 'player', isOwner = false, canSwitchView = true, isPlatform = false }: { viewMode?: ViewMode; isOwner?: boolean; canSwitchView?: boolean; isPlatform?: boolean }) {
  const { profile, signOut } = useAuth()
  const pathname = usePathname()
  const urlTab = useSearchParams()?.get('tab') ?? 'board'
  // The dashboard's own tabs change the address without a page load, so they also say so directly: the bar never lags behind.
  const [tabParam, setTabParam] = useState(urlTab)
  useEffect(() => { setTabParam(urlTab) }, [urlTab])
  useEffect(() => {
    const on = (e: Event) => { const t = (e as CustomEvent).detail; if (typeof t === 'string') setTabParam(t) }
    window.addEventListener('padelmate:tab', on)
    return () => window.removeEventListener('padelmate:tab', on)
  }, [])
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    router.push('/auth/login')
    setMenuOpen(false)
  }

  // The server only ever sends 'manager' to staff and admins, so it is the
  // reliable signal; the profile (loaded in the browser a moment later) only
  // adds the switch for staff who are currently looking at the player side.
  const manager = viewMode === 'manager'
  // What sits under the person's name: managers by their role (Owner, Front desk), players by plan.
  const whoLabel = (p: any) => manager ? (roleLabel(p?.role) ?? 'Manager') : `${tierLabel(p?.membership_tier)} member`
  const isStaff = manager || profile?.role === 'staff' || profile?.role === 'admin'
  const homeHref = homePathFor(viewMode)
  // On the dashboard every tab's data is already on the page, so switching tab is instant: change the address and tell the page,
  // no trip to the server. (From any other page it is a normal link.)
  const quickTab = (e: React.MouseEvent, href: string) => {
    const m = href.match(/^\/admin\?tab=([a-z]+)$/)
    if (pathname !== '/admin' || !m || e.metaKey || e.ctrlKey || e.shiftKey) return
    e.preventDefault()
    const url = new URL(window.location.href); url.searchParams.set('tab', m[1])
    window.history.replaceState(null, '', url.toString())
    window.dispatchEvent(new CustomEvent('padelmate:tab', { detail: m[1] }))
    setMenuOpen(false)
  }
  const managerTabActive = (item: { href: string; tab: string | null }) =>
    item.tab === null ? pathname === '/admin/today' : pathname === '/admin' && tabParam === item.tab

  return (
    <>
      {/* Mobile top bar */}
      <nav className="sticky top-0 z-50 md:hidden"
        style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border)' }}>
        <div className="px-4 h-14 flex items-center justify-between gap-4">
          <Link href={homeHref} className="flex items-center gap-2 font-bold text-sm shrink-0"
            onClick={() => setMenuOpen(false)}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#d4f53c', boxShadow: '0 0 8px #d4f53c99' }} />
            <span style={{ color: 'var(--text-primary)', letterSpacing: '2px' }}>
              PADEL<span style={{ color: 'var(--brand-primary-text)' }}>MATE</span>
            </span>
          </Link>
          <div className="flex items-center gap-2 shrink-0">
            {profile && (
              <span className="badge badge-member capitalize hidden sm:inline-flex">
                {manager ? (roleLabel((profile as any).role) ?? 'Manager') : tierLabel(profile.membership_tier)}
              </span>
            )}
            <ThemeToggle />
            {profile && <PushNotificationToggle />}
            {profile && <NotificationBell userId={profile.id} />}
            {profile && (
              <Link href={`/players/${profile.id}`} style={{
                width: 30, height: 30, borderRadius: '50%',
                background: 'var(--brand-primary)', color: 'var(--brand-primary-on)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, boxShadow: 'var(--glow-primary)',
              }}>
                {getInitials(profile.full_name)}
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile bottom tab bar: docked flush with the bottom of the screen (not floating), solid, with a thin top line */}
      <nav className="fixed left-0 right-0 bottom-0 z-40 md:hidden flex items-center justify-around gap-0.5 px-1.5 pt-2"
        style={{
          paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border)',
          // Pinned to the bottom of the screen: its own layer, so a phone's address bar collapsing or a bounce at the end of
          // the page cannot make it drift or slide.
          transform: 'translateZ(0)',
          WebkitTransform: 'translateZ(0)',
        }}>
        {manager
          ? (isOwner ? OWNER_TAB_ITEMS : DESK_TAB_ITEMS).map(item => (
              <TabBarLink key={item.href} href={item.href} label={item.label} active={managerTabActive(item)} icon={ICONS[item.href]} onClick={e => quickTab(e, item.href)} />
            ))
          : TAB_BAR_ITEMS.map(item => (
              <TabBarLink key={item.href} href={item.href} label={item.label} active={pathname.startsWith(item.href)} />
            ))}
        <button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center justify-center transition-all" style={{
          flexDirection: 'column',
          gap: 2,
          padding: '6px 12px',
          minWidth: 58,
          borderRadius: 14,
          background: menuOpen ? 'var(--brand-primary)' : 'transparent',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ flexShrink: 0, color: menuOpen ? 'var(--brand-primary-on)' : 'var(--text-subtle)' }}>
            <circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>
          </svg>
          <span className="whitespace-nowrap" style={{ fontSize: 10, fontWeight: 700, color: menuOpen ? 'var(--brand-primary-on)' : 'var(--text-subtle)' }}>More</span>
        </button>
      </nav>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 h-screen z-40 w-[220px]"
        style={{ background: 'var(--bg-surface)', borderRight: '1px solid var(--border)' }}>
        <div className="px-3 py-4 flex flex-col h-full overflow-y-auto">
          {/* Logo, then light/dark and the bell up top, like most apps */}
          <div className="flex items-center gap-1 mb-5">
            <Link href={homeHref} className="flex items-center gap-2 font-bold text-sm px-1.5 min-w-0 mr-auto">
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#d4f53c', boxShadow: '0 0 8px #d4f53c99' }} />
              <span style={{ color: 'var(--text-primary)', letterSpacing: '2px' }}>
                PADEL<span style={{ color: 'var(--brand-primary-text)' }}>MATE</span>
              </span>
            </Link>
            <span className="sidebar-icon-btn" data-testid="sidebar-theme"><ThemeToggle /></span>
            {profile && <span className="sidebar-icon-btn" data-testid="sidebar-bell"><NotificationBell userId={profile.id} panelPosition="flyout" /></span>}
          </div>

          {manager ? (
            <>
              <div className="flex flex-col gap-0.5">
                <SidebarLink href="/admin/today" label="Today" active={pathname === '/admin/today'} />
                <SidebarLink href="/admin" label="Dashboard" active={pathname === '/admin'} />
              </div>
              <SidebarGroupLabel>Players and play</SidebarGroupLabel>
              <div className="flex flex-col gap-0.5">
                {MANAGER_CLUB_ITEMS.map(item => (
                  <SidebarLink key={item.href} href={item.href} label={item.label} active={pathname.startsWith(item.href)} />
                ))}
              </div>
              {isOwner && (
                <>
                  <SidebarGroupLabel>Manage your club</SidebarGroupLabel>
                  <div className="flex flex-col gap-0.5" data-testid="manage-group">
                    {OWNER_MANAGE_ITEMS.map(item => (
                      <SidebarLink key={item.href} href={item.href} label={item.label} active={pathname === item.href} />
                    ))}
                  </div>
                </>
              )}
              {isPlatform && (
                <>
                  <SidebarGroupLabel>Platform admin</SidebarGroupLabel>
                  <div className="flex flex-col gap-0.5">
                    <SidebarLink href="/platform" label="Clubs and fees" active={pathname === '/platform'} />
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <div className="flex flex-col gap-0.5">
                {PRIMARY_NAV_ITEMS.map(item => (
                  <SidebarLink key={item.href} href={item.href} label={item.label} active={pathname.startsWith(item.href)} />
                ))}
              </div>

              <SidebarGroupLabel>Club</SidebarGroupLabel>
              <div className="flex flex-col gap-0.5">
                {CLUB_NAV_ITEMS.map(item => (
                  <SidebarLink key={item.href} href={item.href} label={item.label} active={pathname.startsWith(item.href)} />
                ))}
                <SpecialsMenu />
              </div>

            </>
          )}

          <div className="flex-1" />

          {isStaff && canSwitchView && (
            <div className="pt-3">
              <ViewSwitch mode={viewMode} variant="segment" />
            </div>
          )}

          {profile && <ProfileCard initials={getInitials(profile.full_name)} name={profile.full_name ?? ''} who={whoLabel(profile)} onSignOut={handleSignOut} />}
        </div>
      </aside>

      {/* Mobile menu — full overlay */}
      {menuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 md:hidden"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={() => setMenuOpen(false)}
          />
          {/* Menu panel — height-capped and scrollable so every item (down to
              Sign out at the very bottom) stays reachable regardless of how
              tall the content gets (nav items + Specials) or how short the
              screen is. */}
          <div className="fixed top-14 left-0 right-0 z-50 md:hidden overflow-y-auto"
            style={{
              background: 'var(--bg-surface)',
              borderBottom: '1px solid var(--border)',
              maxHeight: 'calc(100vh - 56px)',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}>
            <div className="px-4 py-3 space-y-1">
              {(manager
                ? [
                    { label: null as string | null, items: [...(isOwner ? OWNER_MORE_ITEMS : []), ...MANAGER_CLUB_ITEMS.map(i => ({ ...i, tab: null as string | null }))] },
                    ...(isOwner ? [{ label: 'Manage your club', items: OWNER_MANAGE_ITEMS }] : []),
                    ...(isPlatform ? [{ label: 'Platform admin', items: [{ href: '/platform', label: 'Clubs and fees', tab: null as string | null }] }] : []),
                  ]
                : [{ label: null as string | null, items: NAV_ITEMS as { href: string; label: string; tab?: string | null }[] }]
              ).map(section => (
                <div key={section.label ?? 'main'}>
                  {section.label && (
                    <div className="px-3 pt-3 pb-1 text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-subtle)' }}>{section.label}</div>
                  )}
                  {section.items.map((item: { href: string; label: string; tab?: string | null }) => {
                    const active = manager && item.tab ? pathname === '/admin' && tabParam === item.tab : pathname.startsWith(item.href)
                    return (
                      <Link key={item.href} href={item.href}
                        onClick={e => { setMenuOpen(false); if (manager) quickTab(e, item.href) }}
                        className="flex items-center px-3 py-3 rounded-lg text-base transition-colors"
                        style={{
                          background: active ? 'var(--bg-raised)' : 'transparent',
                          color: active ? 'var(--brand-primary-text)' : 'var(--text-primary)',
                          fontWeight: active ? 500 : 400,
                        }}>
                        {item.label}
                      </Link>
                    )
                  })}
                </div>
              ))}
              {isStaff && canSwitchView && (
                <div className="pt-2">
                  <ViewSwitch mode={viewMode} variant="row" onNavigate={() => setMenuOpen(false)} />
                </div>
              )}
              {!manager && SPECIALS.length > 0 && (
                <div className="pt-3 mt-2" style={{ borderTop: '1px solid var(--border)' }}>
                  <div className="px-3 pb-2 text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--busy-amber)' }}>
                    Specials
                  </div>
                  {SPECIALS.map(s => {
                    const pill = cadencePill(s)
                    return (
                      <div key={s.id} className="px-3 py-2 rounded-lg flex gap-3" style={{ background: 'var(--bg-raised)' }}>
                        {s.stat && (
                          <div className="shrink-0 w-12 h-12 rounded-[10px] flex flex-col items-center justify-center leading-none"
                            style={{
                              background: 'linear-gradient(155deg, var(--brand-primary-muted), transparent 70%)',
                              border: '1px solid var(--brand-primary)',
                            }}>
                            <div className="text-sm font-extrabold" style={{ color: 'var(--brand-primary-text)', fontVariantNumeric: 'tabular-nums' }}>
                              {s.stat.value}
                            </div>
                            <div className="text-[7px] font-bold mt-0.5" style={{ color: 'var(--brand-primary-text)', letterSpacing: '0.03em' }}>
                              {s.stat.unit}
                            </div>
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{s.title}</div>
                          <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>at {s.partnerName}</div>
                          <div className="inline-flex items-center gap-1 mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: 'var(--amber-muted)', color: 'var(--busy-amber)', letterSpacing: '0.02em' }}>
                            {pill.live && <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--busy-amber)' }} />}
                            {pill.text.toUpperCase()}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="pt-3 mt-2 pb-3" style={{ borderTop: '1px solid var(--border)' }}>
                {profile && (
                  <div className="flex items-center justify-between px-3 py-2">
                    <div>
                      <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {profile.full_name}
                      </div>
                      <div className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>
                        {whoLabel(profile)}
                      </div>
                    </div>
                    <button onClick={handleSignOut} className="btn btn-sm btn-danger whitespace-nowrap shrink-0">
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
