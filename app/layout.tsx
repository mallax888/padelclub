import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import AuthProvider from '@/components/ui/AuthProvider'
import { ThemeProvider } from '@/components/ThemeProvider'
import { createServerClient } from '@/lib/supabase-server'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'PadelClub – Book a court',
  description: 'Book padel courts, find a game, split payments.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PadelClub',
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': 'PadelClub',
    'theme-color': '#4DFFEE',
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="theme-color" content="#4DFFEE" />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          <AuthProvider session={session}>
            {children}
            <Toaster
              position="bottom-right"
              toastOptions={{
                style: {
                  borderRadius: '8px',
                  background: '#27272A',
                  borderWidth: '1px',
                  borderColor: '#4DFFEE',
                  color: '#F4F4F5',
                  fontSize: '14px',
                },
              }}
            />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
