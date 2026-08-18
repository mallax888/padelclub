'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from './AuthProvider'
import { getInitials, cn } from '@/lib/utils'
import ThemeToggle from '@/components/ThemeToggle'
import NotificationBell from '@/components/ui/NotificationBell'
import SpecialsMenu from '@/components/ui/SpecialsMenu'
import { SPECIALS, cadencePill } from '@/lib/specials'
import { useState } from 'react'

const ICONS: Record<string, JSX.Element> = {
  '/book': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>
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
  '/tournaments': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M17 5h3a2 2 0 0 1-2 4M7 5H4a2 2 0 0 0 2 4"/><circle cx="12" cy="9" r="2.2"/></svg>
  ),
}

const NAV_ITEMS = [
  { href: '/book',        label: 'Book a court' },
  { href: '/find-a-game', label: 'Find a game' },
  { href: '/mybookings',  label: 'My bookings' },
  { href: '/membership',  label: 'Membership' },
  { href: '/players',      label: 'Players' },
  { href: '/record-match', label: 'Record match' },
  { href: '/tournaments',  label: 'Tournaments' },
]

// The 4 most-used destinations get a permanent slot in the mobile bottom
// tab bar; everything else (Membership, Players, Record match, Admin,
// sign out) lives behind "More", which opens the existing full menu panel.
const TAB_BAR_ITEMS = [
  { href: '/book',        label: 'Book' },
  { href: '/find-a-game', label: 'Find' },
  { href: '/mybookings',  label: 'Bookings' },
  { href: '/tournaments', label: 'Tournaments' },
]

// Primary items get their own row at the top of the sidebar; the rest sit
// under a "Club" group label. A sidebar has room to show everything at
// once, unlike the old horizontal bar, so there's no overflow menu to manage.
const PRIMARY_NAV_ITEMS = NAV_ITEMS.filter(i => ['/book', '/find-a-game', '/mybookings'].includes(i.href))
const CLUB_NAV_ITEMS = NAV_ITEMS.filter(i => !['/book', '/find-a-game', '/mybookings'].includes(i.href))

function SidebarLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link href={href}
      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] transition-colors relative"
      style={{
        background: active ? 'var(--bg-raised)' : 'transparent',
        color: active ? 'var(--brand-primary)' : 'var(--text-muted)',
        fontWeight: active ? 650 : 500,
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text-primary)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--text-muted)' }}
    >
      {active && (
        <span style={{ position: 'absolute', left: -12, top: 8, bottom: 8, width: 3, borderRadius: '0 3px 3px 0', background: 'var(--brand-primary)' }} />
      )}
      <span style={{ width: 17, height: 17, flexShrink: 0 }}>{ICONS[href]}</span>
      {label}
    </Link>
  )
}

function TabBarLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link href={href} className="flex flex-col items-center justify-center gap-1 flex-1 py-1.5">
      <span className="flex items-center justify-center rounded-full transition-all" style={{
        width: 34, height: 34,
        background: active ? 'var(--brand-primary)' : 'transparent',
        color: active ? 'var(--brand-primary-on)' : 'var(--text-subtle)',
        boxShadow: active ? 'var(--glow-primary)' : 'none',
      }}>
        <span style={{ width: 17, height: 17 }}>{ICONS[href]}</span>
      </span>
      <span className="text-[9.5px] font-bold" style={{ color: active ? 'var(--brand-primary)' : 'var(--text-subtle)' }}>{label}</span>
    </Link>
  )
}

function SidebarGroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2.5 pt-4 pb-1.5 text-[10.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-subtle)' }}>
      {children}
    </div>
  )
}

export default function Navbar() {
  const { profile, signOut } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    router.push('/auth/login')
    setMenuOpen(false)
  }

  const isStaff = profile?.role === 'staff' || profile?.role === 'admin'

  return (
    <>
      {/* Mobile top bar */}
      <nav className="sticky top-0 z-50 md:hidden"
        style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border)' }}>
        <div className="px-4 h-14 flex items-center justify-between gap-4">
          <Link href="/book" className="flex items-center gap-2 font-bold text-sm shrink-0"
            onClick={() => setMenuOpen(false)}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand-primary)', boxShadow: 'var(--glow-primary)' }} />
            <span style={{ color: 'var(--text-primary)', letterSpacing: '2px' }}>
              PADEL<span style={{ color: 'var(--brand-primary)' }}>CLUB</span>
            </span>
          </Link>
          <div className="flex items-center gap-2 shrink-0">
            {profile && (
              <span className="badge badge-member capitalize hidden sm:inline-flex">
                {profile.membership_tier}
              </span>
            )}
            <ThemeToggle />
            {profile && <NotificationBell userId={profile.id} />}
            {profile && (
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: 'var(--brand-primary)', color: 'var(--brand-primary-on)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, boxShadow: 'var(--glow-primary)',
              }}>
                {getInitials(profile.full_name)}
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden flex items-stretch"
        style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {TAB_BAR_ITEMS.map(item => (
          <TabBarLink key={item.href} href={item.href} label={item.label} active={pathname.startsWith(item.href)} />
        ))}
        <button onClick={() => setMenuOpen(!menuOpen)} className="flex flex-col items-center justify-center gap-1 flex-1 py-1.5">
          <span className="flex items-center justify-center rounded-full transition-all" style={{
            width: 34, height: 34,
            background: menuOpen ? 'var(--brand-primary)' : 'transparent',
            color: menuOpen ? 'var(--brand-primary-on)' : 'var(--text-subtle)',
            boxShadow: menuOpen ? 'var(--glow-primary)' : 'none',
          }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>
          </span>
          <span className="text-[9.5px] font-bold" style={{ color: menuOpen ? 'var(--brand-primary)' : 'var(--text-subtle)' }}>More</span>
        </button>
      </nav>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 h-screen z-40 w-[220px]"
        style={{ background: 'var(--bg-surface)', borderRight: '1px solid var(--border)' }}>
        <div className="px-3 py-4 flex flex-col h-full overflow-y-auto">
          <Link href="/book" className="flex items-center gap-2 font-bold text-sm px-1.5 mb-5">
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand-primary)', boxShadow: 'var(--glow-primary)' }} />
            <span style={{ color: 'var(--text-primary)', letterSpacing: '2px' }}>
              PADEL<span style={{ color: 'var(--brand-primary)' }}>CLUB</span>
            </span>
          </Link>

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

          {isStaff && (
            <>
              <SidebarGroupLabel>Staff</SidebarGroupLabel>
              <div className="flex flex-col gap-0.5">
                <SidebarLink href="/admin" label="Admin" active={pathname.startsWith('/admin')} />
              </div>
            </>
          )}

          <div className="flex-1" />

          {profile && (
            <div className="pt-3 mt-2" style={{ borderTop: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2.5 px-1.5 mb-2.5">
                <div style={{
                  width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--brand-primary)', color: 'var(--brand-primary-on)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, boxShadow: 'var(--glow-primary)',
                }}>
                  {getInitials(profile.full_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {profile.full_name}
                  </div>
                  <div className="text-[10.5px] capitalize" style={{ color: 'var(--text-muted)' }}>
                    {profile.membership_tier} member
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 px-1.5">
                <ThemeToggle />
                <NotificationBell userId={profile.id} panelPosition="flyout" />
                <button onClick={handleSignOut} className="btn btn-sm ml-auto">
                  Sign out
                </button>
              </div>
            </div>
          )}
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
          {/* Menu panel */}
          <div className="fixed top-14 left-0 right-0 z-50 md:hidden"
            style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
            <div className="px-4 py-3 space-y-1">
              {NAV_ITEMS.map(item => (
                <Link key={item.href} href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center px-3 py-3 rounded-lg text-base transition-colors"
                  style={{
                    background: pathname.startsWith(item.href) ? 'var(--bg-raised)' : 'transparent',
                    color: pathname.startsWith(item.href) ? 'var(--brand-primary)' : 'var(--text-primary)',
                    fontWeight: pathname.startsWith(item.href) ? 500 : 400,
                  }}>
                  {item.label}
                </Link>
              ))}
              {isStaff && (
                <Link href="/admin" onClick={() => setMenuOpen(false)}
                  className="flex items-center px-3 py-3 rounded-lg text-base"
                  style={{ color: 'var(--text-primary)' }}>
                  Admin
                </Link>
              )}
              {SPECIALS.length > 0 && (
                <div className="pt-3 mt-2" style={{ borderTop: '1px solid var(--border)' }}>
                  <div className="px-3 pb-2 text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--brand-accent)' }}>
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
                            <div className="text-sm font-extrabold" style={{ color: 'var(--brand-primary)', fontVariantNumeric: 'tabular-nums' }}>
                              {s.stat.value}
                            </div>
                            <div className="text-[7px] font-bold mt-0.5" style={{ color: 'var(--brand-primary)', letterSpacing: '0.03em' }}>
                              {s.stat.unit}
                            </div>
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{s.title}</div>
                          <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>at {s.partnerName}</div>
                          <div className="inline-flex items-center gap-1 mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: 'var(--brand-accent-muted)', color: 'var(--brand-accent)', letterSpacing: '0.02em' }}>
                            {pill.live && <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--brand-accent)' }} />}
                            {pill.text.toUpperCase()}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="pt-3 mt-2" style={{ borderTop: '1px solid var(--border)' }}>
                {profile && (
                  <div className="flex items-center justify-between px-3 py-2">
                    <div>
                      <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {profile.full_name}
                      </div>
                      <div className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>
                        {profile.membership_tier} member
                      </div>
                    </div>
                    <button onClick={handleSignOut} className="btn btn-sm btn-danger">
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
