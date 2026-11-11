import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { createRegularWeeks } from '@/lib/regulars'

// Turn the booking a player has just made into a weekly regular: books the later
// weeks around it. Players only, for themselves.
export async function POST(request: Request) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { firstBookingId, weeks, skipDates } = body ?? {}
  if (typeof firstBookingId !== 'string' || !Number.isInteger(weeks)) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  if (skipDates !== undefined && (!Array.isArray(skipDates) || skipDates.length > 12 || !skipDates.every((d: unknown) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)))) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const result = await createRegularWeeks(createAdminClient(), { userId: session.user.id, firstBookingId, weeks, skipDates })
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ ok: true, regularId: result.regularId, booked: result.booked, clashes: result.clashes })
}
