'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

// The app always starts on Home: the installed app (the icon on the home screen) and an ordinary browser tab alike.
//
// A phone remembers the page the icon was made from, so an icon added while looking at Book a court opens on Book a court
// forever, and a browser bookmark or a tab typed in as /book does the same. On the first screen of a fresh launch, if that
// page is the bare Book a court screen, go to the front door instead, which sends players to Home and managers to Today.
// Only the very first screen of a launch, and only the bare page: tapping Book in the menu later, a refresh, a link with a
// query (an offer, a freed-up court, a club's booking link) or a notification all go where they say. In a browser a fresh
// launch is a page opened by typing, a bookmark or a new tab (no page sent you there); in the installed app it is the
// first screen after the app is opened.
export default function LaunchHome() {
  const pathname = usePathname()
  const router = useRouter()
  useEffect(() => {
    try {
      const installed = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true
      if (sessionStorage.getItem('pc_launched')) return
      sessionStorage.setItem('pc_launched', '1')
      // In a browser, only a page that was opened directly (typed, bookmarked, new tab), not one a link or a refresh brought you to.
      const nav = (performance.getEntriesByType?.('navigation')?.[0] as PerformanceNavigationTiming | undefined)?.type
      // Automated browsers (tests, crawlers) are left alone: they open /book on purpose, and no person is waiting for Home.
      const opened = installed || (nav === 'navigate' && !document.referrer && !(navigator as any).webdriver)
      if (opened && pathname === '/book' && !window.location.search) router.replace('/')
    } catch { /* private mode or no storage: leave the page alone */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}
