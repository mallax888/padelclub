import { createServerClient } from '@/lib/supabase-server'
import MembershipPanel from '@/components/membership/MembershipPanel'
import { effectivePlans } from '@/lib/plan-rules'
import { loadPlanRows } from '@/lib/club-plans'
import { getVenue, VENUES } from '@/lib/venues'

export default async function MembershipPage() {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session!.user.id)
    .single()

  const { data: transactions } = await supabase
    .from('credit_transactions')
    .select('*')
    .eq('user_id', session!.user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  // The plans this member's home club offers (the standard three until the club
  // changes them).
  const home: string | null = (profile as any)?.home_venue_slug ?? null
  const plans = effectivePlans(home ? await loadPlanRows(supabase as any, [home]) : null, home)
  const clubName = home && VENUES.some(v => v.slug === home) ? getVenue(home).name : null

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Membership & credits</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your plan and session credits</p>
      </div>
      <MembershipPanel profile={profile!} transactions={transactions ?? []} plans={plans} clubName={clubName} />
    </div>
  )
}
