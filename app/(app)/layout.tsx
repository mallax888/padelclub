import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import Navbar from '@/components/ui/Navbar'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/auth/login')
  }

  return (
    <div className="min-h-screen bg-[#323232]">
      <Navbar />
      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-6 overflow-x-hidden">
        {children}
      </main>
    </div>
  )
}
