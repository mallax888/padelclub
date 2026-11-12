import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase-server'
import OnboardingFlow from '@/components/onboarding/OnboardingFlow'
import { INVITE_COOKIE, joinPathFor, safeNext } from '@/lib/return-to'

export const metadata = { title: 'Welcome' }

export default async function OnboardingPage({ searchParams }: { searchParams: { next?: string } }) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed, full_name')
    .eq('id', session!.user.id)
    .single()

  if (profile?.onboarding_completed) {
    redirect(safeNext(searchParams?.next) ?? joinPathFor(cookies().get(INVITE_COOKIE)?.value) ?? '/')
  }

  return <OnboardingFlow userId={session!.user.id} defaultName={profile?.full_name ?? ''} />
}
