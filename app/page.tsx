import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase-server'
import Landing from '@/components/marketing/Landing'
import { VIEW_COOKIE, homePathFor, resolveViewMode } from '@/lib/view-mode'

export default async function Home() {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (session) {
    // Players go to booking; managers go to their Today screen unless they
    // have chosen to look at the app as a player.
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
    redirect(homePathFor(resolveViewMode((profile as any)?.role, cookies().get(VIEW_COOKIE)?.value)))
  }

  return <Landing />
}
