import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

// Paying for a membership only ever set profiles.membership_tier with no
// expiry -- membership_subscriptions (started_at/ends_at) was defined in
// the schema from day one but nothing ever read or wrote it, so a "1 month"
// membership silently lasted forever until someone manually downgraded it.
// The webhook now records a real started_at/ends_at per payment (see
// /api/stripe-webhook); this is the other half -- actually lapsing it once
// that month is up, same as /api/membership/downgrade does for a
// user-initiated downgrade, just on a schedule instead of on request.
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    console.error('CRON_SECRET is not set on this deployment — the membership expiry cron cannot run')
    return NextResponse.json({ error: 'Server misconfigured: CRON_SECRET is not set' }, { status: 500 })
  }
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date().toISOString()

  const { data: expired, error: findError } = await supabase
    .from('membership_subscriptions')
    .select('id, user_id')
    .eq('status', 'active')
    .not('ends_at', 'is', null)
    .lt('ends_at', now)

  if (findError) {
    return NextResponse.json({ error: findError.message }, { status: 500 })
  }
  if (!expired || expired.length === 0) {
    return NextResponse.json({ expired: 0 })
  }

  const { error: subError } = await supabase
    .from('membership_subscriptions')
    .update({ status: 'cancelled' })
    .in('id', expired.map(s => s.id))
  if (subError) {
    return NextResponse.json({ error: subError.message }, { status: 500 })
  }

  // A user could have since bought a newer membership (a fresh row with its
  // own later ends_at) -- only drop their tier back to casual if the row
  // that just expired is still their most recent one, otherwise this would
  // wrongly downgrade someone who already renewed.
  const userIds = Array.from(new Set(expired.map(s => s.user_id)))
  let downgraded = 0
  for (const userId of userIds) {
    const { data: latest } = await supabase
      .from('membership_subscriptions')
      .select('status')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (latest?.status === 'cancelled') {
      await supabase.from('profiles').update({ membership_tier: 'casual' }).eq('id', userId)
      downgraded++
    }
  }

  return NextResponse.json({ expired: expired.length, downgraded })
}
