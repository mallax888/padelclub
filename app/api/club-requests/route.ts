import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { validateClubRequest } from '@/lib/club-access'
import { MIGRATION_MESSAGE, escapeHtml, sendClubEmail, tableMissing } from '@/lib/club-server'

// Public: a club asks to join PadelMate. Nothing is created except the request itself;
// the platform admin approves it by hand. No account, no password, no role is set here.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  // A hidden field real people never fill in: bots do.
  if (body?.website) return NextResponse.json({ ok: true })
  const v = validateClubRequest(body)
  if ('error' in v) return NextResponse.json({ error: v.error, field: v.field }, { status: 400 })
  const r = v.value

  const admin = createAdminClient() as any
  // One waiting request per email (the database enforces it too, in case two arrive together).
  const { data: waiting, error: lookupError } = await admin.from('club_requests').select('id').eq('status', 'pending').ilike('email', r.email).limit(1)
  if (lookupError && tableMissing(lookupError)) return NextResponse.json({ error: MIGRATION_MESSAGE }, { status: 503 })
  if ((waiting ?? []).length > 0) return NextResponse.json({ error: 'We already have a request from that email and are checking it. We will be in touch within one working day.' }, { status: 409 })
  const { error } = await admin.from('club_requests').insert({
    status: 'pending', created_at: new Date().toISOString(),
    club_name: r.clubName, country: r.country, city: r.city, address: r.address || null, courts: r.courts, phone: r.phone || null,
    contact_name: r.contactName, email: r.email,
  })
  if (error) {
    if (tableMissing(error)) return NextResponse.json({ error: MIGRATION_MESSAGE }, { status: 503 })
    if (error.code === '23505') return NextResponse.json({ error: 'We already have a request from that email and are checking it. We will be in touch within one working day.' }, { status: 409 })
    console.error('Could not save a club request', error)
    return NextResponse.json({ error: 'We could not save that. Please try again.' }, { status: 500 })
  }

  // Tell the platform admin (optional: set PLATFORM_NOTIFY_EMAIL).
  const notify = process.env.PLATFORM_NOTIFY_EMAIL
  if (notify) {
    await sendClubEmail({
      to: notify, subject: `New club request: ${r.clubName}`, heading: 'New club request',
      intro: `${escapeHtml(r.contactName)} (${escapeHtml(r.email)}) asked to start <b>${escapeHtml(r.clubName)}</b> in ${escapeHtml(r.city)}, ${escapeHtml(r.country)}.`,
      footer: 'Approve or decline it on the Platform page.',
    })
  }
  return NextResponse.json({ ok: true })
}
