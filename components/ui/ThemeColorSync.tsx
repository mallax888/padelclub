'use client'

import { useEffect } from 'react'
import { useTheme } from 'next-themes'

const THEME_COLORS = { light: '#F1F3F6', dark: '#262B31' }

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
    // Say outright which scheme the page is in, so a browser's own dark mode (Android "Darken websites", Samsung Internet's night
    // mode) has nothing to recolour on the light theme: "only light" opts out, and the dark theme is already dark.
    let scheme = document.querySelector('meta[name="color-scheme"]') as HTMLMetaElement | null
    if (!scheme) { scheme = document.createElement('meta'); scheme.setAttribute('name', 'color-scheme'); document.head.appendChild(scheme) }
    scheme.setAttribute('content', resolvedTheme === 'light' ? 'only light' : 'dark')
  }, [resolvedTheme])

  return null
}
