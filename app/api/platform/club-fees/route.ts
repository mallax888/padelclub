import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { loadTeamCaller } from '@/lib/team-server'
import { isPlatformAdmin } from '@/lib/club-access'
import { validateFee } from '@/lib/connect-rules'

// The platform admin sets PadelClub's fee for one club. Owners never see an editable fee:
// they see the result on each booking.
export async function POST(request: Request) {
  const caller = await loadTeamCaller()
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!isPlatformAdmin(caller)) return NextResponse.json({ error: 'Only the platform admin can change fees.' }, { status: 403 })
  const b = await request.json().catch(() => ({}))
  if (typeof b?.venueSlug !== 'string') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  const fee = validateFee(b.percent, b.fixed ?? 0)
  if ('error' in fee) return NextResponse.json({ error: fee.error }, { status: 400 })
  const admin = createAdminClient() as any
  const { data, error } = await admin.from('club_stripe_accounts')
    .update({ fee_percent: fee.value.percent, fee_fixed: fee.value.fixed, updated_at: new Date().toISOString() })
    .eq('venue_slug', b.venueSlug).select('venue_slug').maybeSingle()
  if (error) return NextResponse.json({ error: "Could not save. Has the 034 database change been run?" }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'That club has not started connecting Stripe yet.' }, { status: 404 })
  return NextResponse.json({ ok: true, fee: fee.value })
}
