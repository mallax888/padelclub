import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import Landing from '@/components/marketing/Landing'

export default async function Home() {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (session) {
    redirect('/book')
  }

  return <Landing />
}
