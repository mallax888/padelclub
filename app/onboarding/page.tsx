import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import OnboardingFlow from '@/components/onboarding/OnboardingFlow'

export default async function OnboardingPage() {
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
    redirect('/book')
  }

  return <OnboardingFlow userId={session!.user.id} defaultName={profile?.full_name ?? ''} />
}
