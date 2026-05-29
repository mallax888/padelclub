import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import { createServerClient } from '@/lib/supabase-server'
import AuthProvider from '@/components/ui/AuthProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'PadelClub — Book a court',
  description: 'Book padel courts online. Memberships available.',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider session={session}>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                borderRadius: '8px',
                background: '#1D9E75',
                color: '#fff',
                fontSize: '14px',
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  )
}
