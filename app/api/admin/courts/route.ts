import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { loadTeamCaller } from '@/lib/team-server'
import { covers } from '@/lib/team'
import { VENUES } from '@/lib/venues'

const MAX_PER_CALL = 20

// Add courts to a club in one go (the setup screen's "Add all courts"). Owners
// only, inside their own reach. The insert runs as the caller, not the service
// role, so the database's own court policy (and its venue and country scoping)
// still applies on top of these checks.
export async function POST(request: Request) {
  const caller = await loadTeamCaller()
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (caller.role !== 'admin') return NextResponse.json({ error: 'Only an owner can add courts.' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const slug = body?.venueSlug
  if (typeof slug !== 'string' || !VENUES.some(v => v.slug === slug)) return NextResponse.json({ error: 'Unknown club.' }, { status: 400 })
  if (!covers(caller.reach, { kind: 'club', venueSlug: slug })) return NextResponse.json({ error: 'That club is outside your reach.' }, { status: 403 })

  const list = Array.isArray(body.courts) ? body.courts : []
  if (list.length === 0 || list.length > MAX_PER_CALL) return NextResponse.json({ error: `Add between 1 and ${MAX_PER_CALL} courts at a time.` }, { status: 400 })

  const rows: any[] = []
  const seen = new Set<string>()
  for (const c of list) {
    const name = typeof c?.name === 'string' ? c.name.trim() : ''
    const type = typeof c?.type === 'string' ? c.type.trim() : ''
    const price = Number(c?.pricePerHour)
    const peak = c?.pricePerHourPeak === null || c?.pricePerHourPeak === undefined || c?.pricePerHourPeak === '' ? null : Number(c.pricePerHourPeak)
    if (!name || name.length > 40 || !type || type.length > 40) return NextResponse.json({ error: 'Each court needs a name and a type.' }, { status: 400 })
    if (!Number.isFinite(price) || price <= 0 || price > 10000) return NextResponse.json({ error: 'Enter a price per hour.' }, { status: 400 })
    if (peak !== null && (!Number.isFinite(peak) || peak <= 0 || peak > 10000)) return NextResponse.json({ error: 'Check the peak price.' }, { status: 400 })
    if (seen.has(name.toLowerCase())) return NextResponse.json({ error: `"${name}" is listed twice.` }, { status: 400 })
    seen.add(name.toLowerCase())
    rows.push({ venue_slug: slug, name, type, price_per_hour: price, price_per_hour_peak: peak, is_indoor: c?.isIndoor !== false, is_active: true, description: null })
  }

  const supabase = createServerClient()
  const { data: existing } = await supabase.from('courts').select('name').eq('venue_slug', slug)
  const have = new Set(((existing ?? []) as any[]).map(c => String(c.name).toLowerCase()))
  const clash = rows.find(r => have.has(r.name.toLowerCase()))
  if (clash) return NextResponse.json({ error: `${clash.name} already exists at this club.` }, { status: 400 })

  const { error } = await supabase.from('courts').insert(rows)
  if (error) {
    console.error('Could not add courts', slug, error)
    return NextResponse.json({ error: 'Could not add the courts. Please try again.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, added: rows.length })
}
