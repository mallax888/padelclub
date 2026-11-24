import { NextResponse } from 'next/server'
import { ownerGuard } from '@/lib/contacts-api'
import { knownFor } from '@/lib/contacts-server'
import { MAX_ROWS, isEmail, normEmail } from '@/lib/contact-import'

// Which of the file's emails already have a PadelMate account, or are already this club's contacts. Says which, never who.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const g = await ownerGuard(body); if (g.ok === false) return g.res
  const emails = Array.isArray(body?.emails) ? (body.emails as unknown[]).map(normEmail).filter(isEmail) : []
  if (emails.length > MAX_ROWS) return NextResponse.json({ error: `Up to ${MAX_ROWS.toLocaleString()} people at a time.` }, { status: 400 })
  const known = await knownFor(g.admin, g.slug, emails)
  return NextResponse.json({ onPadelmate: Array.from(known.profiles.keys()), imported: Array.from(known.contacts) })
}
