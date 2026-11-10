import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

// Whether the database has the column invite links need. The booking flow asks
// before it shows the "invite by link" control, so a deployment that hasn't had
// 023_invite_seats.sql run yet simply doesn't offer it, rather than offering it
// and then failing half-way through somebody's booking -- after the court is
// already held and the people they did pick have already been notified.
export async function GET() {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ available: false }, { status: 401 })

  const admin = createAdminClient()
  const { error } = await (admin.from('booking_splits') as any).select('invite_token').limit(1)
  // Any failure at all means "don't offer it": a half-working feature is worse
  // than a missing one.
  return NextResponse.json({ available: !error })
}
