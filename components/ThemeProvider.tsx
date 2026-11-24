'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { type ThemeProviderProps } from 'next-themes'

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      // Our own CSS sets color-scheme (light is "only light", dark is dark). Left on, next-themes writes a plain
      // "light" onto the page, which lets Android Chrome's "Darken websites" recolour the light theme.
      enableColorScheme={false}
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}


