'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from './AuthProvider'
import { getInitials, cn } from '@/lib/utils'
import ThemeToggle from '@/components/ThemeToggle'
import { useState } from 'react'

const NAV_ITEMS = [
  { href: '/book',        label: 'Book a court' },
  { href: '/find-a-game', label: 'Find a game' },
  { href: '/mybookings',  label: 'My bookings' },
  { href: '/membership',  label: 'Membership' },
  { href: '/players',     label: 'Players' },
]

export default function Navbar() {
  const { profile, signOut } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    router.push('/auth/login')
  }

  const isStaff = profile?.role === 'staff' || profile?.role === 'admin'

  return (
    <>
      <nav className="sticky top-0 z-40"
        style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">

          {/* Logo */}
          <Link href="/book" className="flex items-center gap-2 font-bold text-sm shrink-0">
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand-primary)', boxShadow: 'var(--glow-primary)' }} />
            <span style={{ color: 'var(--text-primary)', letterSpacing: '2px' }}>
              PADEL<span style={{ color: 'var(--brand-primary)' }}>CLUB</span>
            </span>
          </Link>

          {/* Desktop nav */}
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

          {/* Right side */}
          <div className="flex items-center gap-2 shrink-0">
            {profile && (
              <span className="badge badge-member capitalize hidden sm:inline-flex">
                {profile.membership_tier}
              </span>
            )}
            <ThemeToggle />
            {profile ? (
              <>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: 'var(--brand-primary)', color: 'var(--brand-primary-on)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, boxShadow: 'var(--glow-primary)',
                }}>
                  {getInitials(profile.full_name)}
                </div>
                <button onClick={handleSignOut} className="btn btn-sm hidden md:inline-flex">
                  Sign out
                </button>
              </>
            ) : (
              <Link href="/auth/login" className="btn btn-primary btn-sm hidden md:inline-flex">
                Sign in
              </Link>
            )}

            {/* Hamburger — mobile only */}
            <button
              className="flex md:hidden flex-col gap-1.5 p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
            >
              <span style={{ display: 'block', width: 20, height: 2, background: 'currentColor', borderRadius: 2, transition: 'all 0.2s',
                transform: menuOpen ? 'translateY(5px) rotate(45deg)' : 'none' }} />
              <span style={{ display: 'block', width: 20, height: 2, background: 'currentColor', borderRadius: 2, transition: 'all 0.2s',
                opacity: menuOpen ? 0 : 1 }} />
              <span style={{ display: 'block', width: 20, height: 2, background: 'currentColor', borderRadius: 2, transition: 'all 0.2s',
                transform: menuOpen ? 'translateY(-5px) rotate(-45deg)' : 'none' }} />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-30 md:hidden" onClick={() => setMenuOpen(false)}>
          <div className="absolute top-14 left-0 right-0 shadow-xl"
            style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 space-y-1">
              {NAV_ITEMS.map(item => (
                <Link key={item.href} href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center px-3 py-2.5 rounded-lg text-sm transition-colors"
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
                  className="flex items-center px-3 py-2.5 rounded-lg text-sm"
                  style={{ color: 'var(--text-primary)' }}>
                  Admin
                </Link>
              )}
              <div className="pt-2 mt-2" style={{ borderTop: '1px solid var(--border)' }}>
                {profile ? (
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
                ) : (
                  <Link href="/auth/login" onClick={() => setMenuOpen(false)}
                    className="btn btn-primary w-full justify-center">
                    Sign in
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
