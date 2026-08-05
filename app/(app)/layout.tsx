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
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <Navbar />
      {/* md:ml offsets the fixed desktop sidebar; the inner wrapper keeps the
          existing centered content width within whatever space remains. */}
      <main className="md:ml-[220px] px-3 sm:px-4 py-6 overflow-x-hidden">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
