'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from './AuthProvider'
import { getInitials } from '@/lib/utils'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/book',        label: 'Book a court' },
  { href: '/mybookings',  label: 'My bookings' },
  { href: '/membership',  label: 'Membership' },
]

export default function Navbar() {
  const { profile, signOut } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut()
    router.push('/auth/login')
  }

  const isStaff = profile?.role === 'staff' || profile?.role === 'admin'

  return (
    <nav className="sticky top-0 z-40 bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link href="/book" className="flex items-center gap-2 font-semibold text-base shrink-0">
          <span className="text-brand-400 text-xl">●</span>
          <span>Padel<span className="text-brand-400">Club</span></span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'nav-tab',
                pathname.startsWith(item.href) && 'nav-tab-active'
              )}
            >
              {item.label}
            </Link>
          ))}
          {isStaff && (
            <Link
              href="/admin"
              className={cn(
                'nav-tab',
                pathname.startsWith('/admin') && 'nav-tab-active'
              )}
            >
              Admin
            </Link>
          )}
        </div>

        {/* User area */}
        <div className="flex items-center gap-3 shrink-0">
          {profile ? (
            <>
              <span className={cn('badge', profile?.role ?? 'member' === 'member' ? 'badge-member' : 'badge-staff')}>
                {profile?.role ?? 'member' === 'member'
                  ? profile.membership_tier.charAt(0).toUpperCase() + profile.membership_tier.slice(1)
                  : profile?.role ?? 'member'}
              </span>
              <span className="text-sm text-gray-500 hidden sm:block">{profile?.full_name}</span>
              <div className="w-8 h-8 rounded-full bg-brand-400 text-white flex items-center justify-center text-xs font-medium">
                {getInitials(profile?.full_name)}
              </div>
              <button onClick={handleSignOut} className="btn btn-sm text-gray-500">
                Sign out
              </button>
            </>
          ) : (
            <Link href="/auth/login" className="btn btn-primary btn-sm">Sign in</Link>
          )}
        </div>

      </div>
    </nav>
  )
}
