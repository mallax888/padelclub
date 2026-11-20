import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { loadTeamCaller } from '@/lib/team-server'
import { covers } from '@/lib/team'
import { hoursUntilBooking } from '@/lib/timezone'

// The club team marks a booking as a no-show (nobody turned up), or takes the mark off again. Nothing is
// refunded: the payment was already kept. This only records what happened.
export async function POST(request: Request) {
  const caller = await loadTeamCaller()
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (caller.role !== 'admin' && caller.role !== 'staff') return NextResponse.json({ error: 'Only the club team can do this.' }, { status: 403 })
  const b = await request.json().catch(() => ({}))
  if (typeof b?.bookingId !== 'string' || typeof b?.noShow !== 'boolean') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  const admin = createAdminClient() as any
  const { data: booking } = await admin.from('bookings').select('id, status, date, start_time, courts(venue_slug)').eq('id', b.bookingId).maybeSingle()
  if (!booking) return NextResponse.json({ error: 'We could not find that booking.' }, { status: 404 })
  const slug = (booking.courts as any)?.venue_slug
  if (!slug || !covers(caller.reach, { kind: 'club', venueSlug: slug })) return NextResponse.json({ error: 'That booking is outside your club.' }, { status: 403 })
  if (b.noShow) {
    if (booking.status !== 'confirmed') return NextResponse.json({ error: 'Only a confirmed booking can be marked as a no-show.' }, { status: 409 })
    if (hoursUntilBooking(booking.date, booking.start_time, slug) > 0) return NextResponse.json({ error: 'It has not started yet.' }, { status: 409 })
  }
  const { error } = await admin.from('bookings').update({ no_show_at: b.noShow ? new Date().toISOString() : null }).eq('id', b.bookingId)
  if (error) {
    const missing = error.code === '42703' || error.code === 'PGRST204' || /no_show_at/i.test(String(error.message ?? ''))
    return NextResponse.json({ error: missing ? "No-shows aren't switched on yet. Run the 037 database change first." : 'Could not save. Please try again.' }, { status: missing ? 503 : 500 })
  }
  return NextResponse.json({ ok: true })
}
