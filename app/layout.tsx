import type { Metadata } from 'next'
import { Inter, Manrope } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import AuthProvider from '@/components/ui/AuthProvider'
import { ThemeProvider } from '@/components/ThemeProvider'
import { createServerClient } from '@/lib/supabase-server'
import Script from 'next/script'
import SupportChatButton from '@/components/ui/SupportChatButton'

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
    'theme-color': '#0A1B27',
  },
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
        <meta name="theme-color" content="#0A1B27" />
      </head>
      <body className={`${inter.className} ${manrope.variable}`}>
        <ThemeProvider defaultTheme="system" enableSystem>
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



