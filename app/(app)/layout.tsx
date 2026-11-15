import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import Navbar from '@/components/ui/Navbar'
import { splitOn } from '@/lib/club-access'
import { VIEW_COOKIE, isOwnerRole, resolveViewMode } from '@/lib/view-mode'

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

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed, role, managed_venue_slug, managed_country')
    .eq('id', session!.user.id)
    .single()

  if (profile && !profile.onboarding_completed) {
    redirect('/onboarding')
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <Navbar viewMode={resolveViewMode((profile as any)?.role, cookies().get(VIEW_COOKIE)?.value, splitOn())} isOwner={isOwnerRole((profile as any)?.role)} canSwitchView={!splitOn()} isPlatform={(profile as any)?.role === 'admin' && !(profile as any)?.managed_venue_slug && !(profile as any)?.managed_country} />
      {/* md:ml offsets the fixed desktop sidebar; the inner wrapper keeps the
          existing centered content width within whatever space remains. */}
      <main className="md:ml-[220px] px-3 sm:px-4 pt-6 pb-[calc(84px+env(safe-area-inset-bottom))] md:pb-6 overflow-x-hidden">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
