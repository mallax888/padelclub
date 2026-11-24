import { NextResponse } from 'next/server'
import { ownerGuard } from '@/lib/contacts-api'
import { importContacts } from '@/lib/contacts-server'
import { MAX_ROWS, sanitizeRow, type ContactRow } from '@/lib/contact-import'

// Saves the checked list as the club's contacts. Every row is checked again here: nothing from the browser is trusted.
// Nobody is emailed by this: sending the invite is a separate step the owner confirms.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const g = await ownerGuard(body); if (g.ok === false) return g.res
  if (!Array.isArray(body?.rows)) return NextResponse.json({ error: 'No players to import.' }, { status: 400 })
  if (body.rows.length > MAX_ROWS) return NextResponse.json({ error: `Up to ${MAX_ROWS.toLocaleString()} people at a time.` }, { status: 400 })
  const rows = (body.rows as unknown[]).map(sanitizeRow).filter((r): r is ContactRow => !!r)
  if (rows.length === 0) return NextResponse.json({ error: 'There are no valid players in that list.' }, { status: 400 })
  try {
    return NextResponse.json({ ok: true, ...(await importContacts(g.admin, g.slug, rows, g.caller.id)) })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Could not save the players.' }, { status: 500 })
  }
}
