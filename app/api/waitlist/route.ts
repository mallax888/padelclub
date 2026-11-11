import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { isMissingTable, isOpenForBooking, weekFor, loadVenueSettings } from '@/lib/venue-settings'
import { dayHours, toMinutes } from '@/lib/venue-hours'
import { timezoneForVenueSlug, venueInstant } from '@/lib/timezone'
import { isSlotFull, MAX_ACTIVE_WAITS, toMin, WAIT_DURATIONS } from '@/lib/waitlist-rules'
import { knownVenue } from '@/lib/waitlist'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^(?:[01]\d|2[0-3]):(?:00|30)$/
const MAX_DAYS_AHEAD = 60

// Join the waitlist for a time that is full. Players only, for themselves. The
// server checks the time really is full (a free time should just be booked), is
// inside opening hours and still in the future, and keeps each player to a few
// waits at once.
export async function POST(request: Request) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const userId = session.user.id

  const body = await request.json().catch(() => ({}))
  const { venueSlug, date, time, durationMinutes } = body ?? {}
  if (!knownVenue(venueSlug) || typeof date !== 'string' || !DATE_RE.test(date) || typeof time !== 'string' || !TIME_RE.test(time)
    || !(WAIT_DURATIONS as readonly number[]).includes(durationMinutes)) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const admin: any = createAdminClient()
  const { data: courts } = await admin.from('courts').select('id').eq('venue_slug', venueSlug).eq('is_active', true)
  const courtIds = ((courts ?? []) as any[]).map(c => c.id as string)
  const settings = await loadVenueSettings(admin)
  if (courtIds.length === 0 || !isOpenForBooking(settings, venueSlug)) return NextResponse.json({ error: "This club isn't open for booking yet." }, { status: 400 })

  const tz = timezoneForVenueSlug(venueSlug)
  const now = Date.now()
  const startAt = venueInstant(date, `${time}:00`, tz).getTime()
  if (startAt <= now) return NextResponse.json({ error: 'That time has already started.' }, { status: 400 })
  if (startAt > now + MAX_DAYS_AHEAD * 24 * 3600 * 1000) return NextResponse.json({ error: 'That is too far ahead to wait for.' }, { status: 400 })

  const open = dayHours(weekFor(settings, venueSlug), date)
  if (!open || toMin(time) < toMinutes(open.open) || toMin(time) + durationMinutes > toMinutes(open.close)) {
    return NextResponse.json({ error: 'That time is outside the club\'s opening hours.' }, { status: 400 })
  }

  const { data: busyRows } = await admin.from('bookings').select('court_id, start_time, duration_minutes')
    .in('court_id', courtIds).eq('date', date).in('status', ['confirmed', 'blocked'])
  if (!isSlotFull(courtIds, (busyRows ?? []) as any[], toMin(time), durationMinutes)) {
    return NextResponse.json({ error: 'A court is free at that time. You can book it now.' }, { status: 409 })
  }

  const unavailable = NextResponse.json({ error: "The waitlist isn't switched on yet." }, { status: 503 })
  const { data: mine, error: readError } = await admin.from('waitlist').select('id, venue_slug, date, start_time, status').eq('user_id', userId).in('status', ['waiting', 'notified']).gte('date', new Date(now - 24 * 3600 * 1000).toISOString().slice(0, 10))
  if (isMissingTable(readError) || readError?.code === '42P01' || readError?.code === 'PGRST205') return unavailable
  if (readError) return NextResponse.json({ error: 'Could not save. Please try again.' }, { status: 500 })

  const here = (mine ?? []).find((w: any) => w.venue_slug === venueSlug && w.date === date && String(w.start_time).slice(0, 5) === time)
  if (here) return NextResponse.json({ ok: true, alreadyWaiting: true })
  const active = (mine ?? []).filter((w: any) => venueInstant(w.date, `${String(w.start_time).slice(0, 5)}:00`, timezoneForVenueSlug(w.venue_slug)).getTime() > now)
  if (active.length >= MAX_ACTIVE_WAITS) {
    return NextResponse.json({ error: `You can wait for up to ${MAX_ACTIVE_WAITS} times at once. Stop waiting for one first.` }, { status: 400 })
  }

  // Re-joining a time you had stopped waiting for reuses its row.
  const { data: old } = await admin.from('waitlist').select('id').eq('user_id', userId).eq('venue_slug', venueSlug).eq('date', date).eq('start_time', `${time}:00`).maybeSingle()
  const { error } = old
    ? await admin.from('waitlist').update({ status: 'waiting', notified_at: null, duration_minutes: durationMinutes }).eq('id', old.id)
    : await admin.from('waitlist').insert({ user_id: userId, venue_slug: venueSlug, date, start_time: `${time}:00`, duration_minutes: durationMinutes, status: 'waiting' })
  if (error) {
    console.error('Could not join waitlist', error)
    return NextResponse.json({ error: 'Could not save. Please try again.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
