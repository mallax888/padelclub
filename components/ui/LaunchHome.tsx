'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

// The installed app (the icon on the home screen) always starts on Home.
//
// A phone remembers the page the icon was made from, so an icon added while looking at Book a court opens on Book a court
// forever. On the first screen of a fresh launch, if that page is the bare Book a court screen, go to the front door
// instead, which sends players to Home and managers to Today. Only the very first screen of a launch, only the installed
// app, and only the bare page: tapping Book in the menu later, a link, or a notification that lands on /book with a
// query (an offer, a freed-up court) all go where they say.
export default function LaunchHome() {
  const pathname = usePathname()
  const router = useRouter()
  useEffect(() => {
    try {
      const installed = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true
      if (!installed) return
      if (sessionStorage.getItem('pc_launched')) return
      sessionStorage.setItem('pc_launched', '1')
      if (pathname === '/book' && !window.location.search) router.replace('/')
    } catch { /* private mode or no storage: leave the page alone */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}
