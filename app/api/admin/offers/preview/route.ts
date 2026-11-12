import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { loadTeamCaller } from '@/lib/team-server'
import { covers } from '@/lib/team'
import { VENUES } from '@/lib/venues'
import { previewOffer } from '@/lib/offers'
import { OFFER_PERCENTS } from '@/lib/offer-rules'

// What an offer would reach and earn, shown to the owner before they send it.
export async function GET(request: Request) {
  const caller = await loadTeamCaller()
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (caller.role !== 'admin') return NextResponse.json({ error: 'Only an owner can send offers.' }, { status: 403 })
  const q = new URL(request.url).searchParams
  const venueSlug = q.get('venue') ?? '', date = q.get('date') ?? '', startTime = (q.get('start') ?? '').slice(0, 5), endTime = (q.get('end') ?? '').slice(0, 5), percent = Number(q.get('percent'))
  if (!VENUES.some(v => v.slug === venueSlug) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime) || startTime >= endTime || !(OFFER_PERCENTS as readonly number[]).includes(percent)) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  if (!covers(caller.reach, { kind: 'club', venueSlug })) return NextResponse.json({ error: 'That club is outside your reach.' }, { status: 403 })
  return NextResponse.json(await previewOffer(createAdminClient(), { venueSlug, date, startTime, endTime, percent }), { headers: { 'Cache-Control': 'no-store' } })
}
