import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

// Moving to a paid tier goes through /api/checkout-membership so it's
// actually charged; dropping back to the free "casual" tier has no charge
// to verify, so it's a plain admin-client update instead of a Stripe flow.
export async function POST() {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const admin = createAdminClient()
  const { error } = await admin.from('profiles').update({ membership_tier: 'casual' }).eq('id', session.user.id)
  if (error) {
    return NextResponse.json({ error: 'Could not update membership' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
