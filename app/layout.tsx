import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import AuthProvider from '@/components/ui/AuthProvider'
import { ThemeProvider } from '@/components/ThemeProvider'
import { createServerClient } from '@/lib/supabase-server'
import Script from 'next/script'

const inter = Inter({ subsets: ['latin'] })

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
    'theme-color': '#4DFFEE',
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
        <meta name="theme-color" content="#4DFFEE" />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          <AuthProvider session={session}>
            {children}
            <Toaster position="bottom-right" containerStyle={{ right: 80 }}
              toastOptions={{ style: { borderRadius: '8px', background: '#27272A', borderWidth: '1px', borderColor: '#4DFFEE', color: '#F4F4F5', fontSize: '14px' } }} />
            <a href="https://wa.me/6421994173?text=Hi%20PadelClub%2C%20I%20need%20help" target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp" className="whatsapp-btn" style={{ position: 'fixed', bottom: '20px', right: '20px', width: '52px', height: '52px', borderRadius: '50%', background: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(37,211,102,0.4)', zIndex: 9999 }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            </a>
            <div className="tawkto-desktop">
              <Script id="tawkto" strategy="lazyOnload" dangerouslySetInnerHTML={{ __html: `var Tawk_API=Tawk_API||{}; Tawk_API.onLoad=function(){ if(window.innerWidth<=768){ Tawk_API.hideWidget(); } };(function(){var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];s1.async=true;s1.src="https://embed.tawk.to/6a3ef2c035bb181d4aa8b900/1js2u8gj8";s1.charset="UTF-8";s1.setAttribute("crossorigin","*");s0.parentNode.insertBefore(s1,s0);})();` }} />
            </div>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}



