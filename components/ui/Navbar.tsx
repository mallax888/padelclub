'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from './AuthProvider'
import { getInitials, cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/book',       label: 'Book a court' },
  { href: '/mybookings', label: 'My bookings' },
  { href: '/membership', label: 'Membership' },
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
    <nav className="sticky top-0 z-40" style={{background:'#242424',borderBottom:'1px solid #333'}}>
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">

        <Link href="/book" className="flex items-center gap-2 font-semibold text-base shrink-0">
          <div style={{width:10,height:10,borderRadius:'50%',background:'#1D9E75'}}></div>
          <span style={{color:'#fff'}}>Padel<span style={{color:'#1D9E75'}}>Club</span></span>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={cn('nav-tab', pathname.startsWith(item.href) && 'nav-tab-active')}
            >
              {item.label}
            </Link>
          ))}
          {isStaff && (
            <Link
              href="/admin"
              className={cn('nav-tab', pathname.startsWith('/admin') && 'nav-tab-active')}
            >
              Admin
            </Link>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {profile ? (
            <>
              <span className="badge badge-member">
                {profile.membership_tier.charAt(0).toUpperCase() + profile.membership_tier.slice(1)}
              </span>
              <span className="text-sm hidden sm:block" style={{color:'#aaa'}}>{profile.full_name}</span>
              <div style={{width:30,height:30,borderRadius:'50%',background:'#1D9E75',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:500}}>
                {getInitials(profile.full_name)}
              </div>
              <button onClick={handleSignOut} className="btn btn-sm" style={{color:'#aaa',borderColor:'#444',background:'transparent'}}>
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