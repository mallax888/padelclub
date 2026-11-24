import { NextResponse } from 'next/server'
import { ownerGuard } from '@/lib/contacts-api'
import { sendBatch } from '@/lib/contacts-server'
import { cleanIntro } from '@/lib/contact-rules'
import { getVenue } from '@/lib/venues'
import { getAppUrl } from '@/lib/env'

// Sends the invite (or the one reminder) to the next batch of the club's contacts. The browser calls it again until nothing
// remains. The owner has already seen the exact email and ticked the confirmation; the tick is required here too.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const g = await ownerGuard(body); if (g.ok === false) return g.res
  const mode = body?.mode === 'remind' ? 'remind' : body?.mode === 'invite' ? 'invite' : null
  if (!mode) return NextResponse.json({ error: 'Choose invite or reminder.' }, { status: 400 })
  if (body?.confirmed !== true) return NextResponse.json({ error: 'Please confirm these people gave the club their details.' }, { status: 400 })
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: 'Email is not set up yet, so nothing was sent.' }, { status: 503 })
  const venue = getVenue(g.slug)!
  try {
    const r = await sendBatch(g.admin, { slug: g.slug, venueName: venue.name, mode, intro: cleanIntro(body?.intro), origin: getAppUrl(request) })
    return NextResponse.json({ ok: true, ...r })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Could not send.' }, { status: 500 })
  }
}
