import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { createInviteSeats } from '@/lib/invites'

// The admin client, deliberately: these are rows with no user on them, which
// the booker's own row-level-security policies were never written to allow.
// Ownership is checked in createInviteSeats instead -- the booking has to be the
// caller's, still ahead of them and not cancelled.
export async function POST(request: Request) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const result = await createInviteSeats(createAdminClient(), session.user.id, {
    bookingId: body?.bookingId,
    count: body?.count,
    totalSeats: body?.totalSeats,
  })
  // 'error' in result, not !result.ok: this repo isn't compiled with
  // strictNullChecks, and without it TypeScript can't narrow on a boolean flag.
  if ('error' in result) {
    return NextResponse.json(
      { error: result.error, ...(result.featureMissing ? { featureMissing: true } : {}) },
      { status: result.status },
    )
  }
  return NextResponse.json({ created: result.created })
}
