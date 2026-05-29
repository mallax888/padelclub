import { createServerClient } from '@/lib/supabase-server'
import MembershipPanel from '@/components/membership/MembershipPanel'

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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Membership & credits</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your plan and session credits</p>
      </div>
      <MembershipPanel profile={profile!} transactions={transactions ?? []} />
    </div>
  )
}
