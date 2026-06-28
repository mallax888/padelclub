'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from './AuthProvider'
import { getInitials, cn } from '@/lib/utils'
import ThemeToggle from '@/components/ThemeToggle'
import NotificationBell from '@/components/ui/NotificationBell'
import { useState, Fragment } from 'react'

const NAV_ITEMS = [
  { href: '/book',        label: 'Book a court' },
  { href: '/find-a-game', label: 'Find a game' },
  { href: '/mybookings',  label: 'My bookings' },
  { href: '/membership',  label: 'Membership' },
  { href: '/players',     label: 'Players' },
  { href: '/record-match', label: 'Record match' },
]

const WhatsAppIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
)

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
    <Fragment>
      <nav className="sticky top-0 z-50"
        style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <Link href="/book" className="flex items-center gap-2 font-bold text-sm shrink-0"
            onClick={() => setMenuOpen(false)}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand-primary)', boxShadow: 'var(--glow-primary)' }} />
            <span style={{ color: 'var(--text-primary)', letterSpacing: '2px' }}>
              PADEL<span style={{ color: 'var(--brand-primary)' }}>CLUB</span>
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map(item => (
              <Link key={item.href} href={item.href}
                className={cn('nav-tab', pathname.startsWith(item.href) && 'nav-tab-active')}>
                {item.label}
              </Link>
            ))}
            {isStaff && (
              <Link href="/admin"
                className={cn('nav-tab', pathname.startsWith('/admin') && 'nav-tab-active')}>
                Admin
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {profile && (
              <span className="badge badge-member capitalize hidden sm:inline-flex">
                {profile.membership_tier}
              </span>
            )}
            <ThemeToggle />
            {profile && <NotificationBell userId={profile.id} />}
            
              href="https://wa.me/6421994173?text=Hi%20PadelClub%2C%20I%20need%20help"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Chat on WhatsApp"
              className="hidden md:flex items-center justify-center w-8 h-8 rounded-full transition-opacity hover:opacity-80"
              style={{ background: '#25D366', color: '#fff', flexShrink: 0 }}
            >
              <WhatsAppIcon />
            </a>
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
            <button onClick={handleSignOut} className="btn btn-sm hidden md:inline-flex">
              Sign out
            </button>
            <button
              className="flex md:hidden items-center justify-center w-9 h-9 rounded-lg"
              style={{ color: 'var(--text-muted)', background: menuOpen ? 'var(--bg-raised)' : 'transparent' }}
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
            >
              {menuOpen ? (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="2" y1="2" x2="16" y2="16"/>
                  <line x1="16" y1="2" x2="2" y2="16"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="2" y1="4" x2="16" y2="4"/>
                  <line x1="2" y1="9" x2="16" y2="9"/>
                  <line x1="2" y1="14" x2="16" y2="14"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </nav>
      {menuOpen && (
        <Fragment>
          <div className="fixed inset-0 z-40 md:hidden" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setMenuOpen(false)} />
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
              <div className="pt-3 mt-2" style={{ borderTop: '1px solid var(--border)' }}>
                {profile && (
                  <div className="flex items-center justify-between px-3 py-2">
                    <div>
                      <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{profile.full_name}</div>
                      <div className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>{profile.membership_tier} member</div>
                    </div>
                    <button onClick={handleSignOut} className="btn btn-sm btn-danger">Sign out</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Fragment>
      )}
    </Fragment>
  )
}
