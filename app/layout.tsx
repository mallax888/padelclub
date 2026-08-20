import type { Metadata, Viewport } from 'next'
import { Inter, Manrope } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import AuthProvider from '@/components/ui/AuthProvider'
import { ThemeProvider } from '@/components/ThemeProvider'
import { createServerClient } from '@/lib/supabase-server'
import Script from 'next/script'
import SupportChatButton from '@/components/ui/SupportChatButton'
import ThemeColorSync from '@/components/ui/ThemeColorSync'

const inter = Inter({ subsets: ['latin'] })
const manrope = Manrope({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-display' })

export const metadata: Metadata = {
  title: 'PadelClub - Book a court',
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
  },
}

// A single static theme-color doesn't track the auto light/dark switch --
// Android was showing a dark status/address bar over a light-mode page.
// These two, media-matched, keep the browser chrome colour in sync with
// --bg-base in each theme (app/globals.css).
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#EEF3F1' },
    { media: '(prefers-color-scheme: dark)', color: '#050C11' },
  ],
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="icon" href="/icons/icon-192.png" type="image/png" />
      </head>
      <body className={`${inter.className} ${manrope.variable}`}>
        <ThemeProvider defaultTheme="system" enableSystem>
          <ThemeColorSync />
          <AuthProvider session={session}>
            {children}
            <Toaster position="bottom-right" containerStyle={{ right: 130, bottom: 30 }}
              toastOptions={{ style: { borderRadius: '8px', background: 'var(--bg-surface)', borderWidth: '1px', borderColor: 'var(--brand-primary)', color: 'var(--text-primary)', fontSize: '14px' } }} />
            <Script id="tawkto" strategy="lazyOnload" dangerouslySetInnerHTML={{ __html: `var Tawk_API=Tawk_API||{}; Tawk_API.onLoad=function(){ Tawk_API.hideWidget(); };(function(){var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];s1.async=true;s1.src="https://embed.tawk.to/6a3ef2c035bb181d4aa8b900/1js2u8gj8";s1.charset="UTF-8";s1.setAttribute("crossorigin","*");s0.parentNode.insertBefore(s1,s0);})();` }} />
            <SupportChatButton />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}



