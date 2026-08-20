'use client'

import { useEffect } from 'react'
import { useTheme } from 'next-themes'

const THEME_COLORS = { light: '#EEF3F1', dark: '#050C11' }

// The static media-matched theme-color tags in layout.tsx only track the
// device's OS-level light/dark setting -- if someone manually overrides the
// theme with the in-app toggle, resolvedTheme diverges from that, so this
// keeps the browser chrome (Android status/address bar) in sync with
// whichever theme is actually rendered, not just the OS default.
export default function ThemeColorSync() {
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    if (resolvedTheme !== 'light' && resolvedTheme !== 'dark') return
    let meta = document.querySelector('meta[name="theme-color"]:not([media])') as HTMLMetaElement | null
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'theme-color')
      document.head.appendChild(meta)
    }
    meta.setAttribute('content', THEME_COLORS[resolvedTheme])
  }, [resolvedTheme])

  return null
}
