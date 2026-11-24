import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { verifyUnsub } from '@/lib/unsubscribe'

// Public. Needs the signed link from the email. Handles the button on the page and mail apps' one-click unsubscribe.
export async function POST(request: Request) {
  const url = new URL(request.url)
  let c = url.searchParams.get('c'), s = url.searchParams.get('s')
  if (!c || !s) {
    const form = await request.formData().catch(() => null)
    c = (form?.get('c') as string) ?? c; s = (form?.get('s') as string) ?? s
  }
  if (!verifyUnsub(c, s)) return NextResponse.json({ error: 'This link is not valid.' }, { status: 400 })
  const admin = createAdminClient() as any
  const { error } = await admin.from('club_contacts').update({ unsubscribed_at: new Date().toISOString() }).eq('id', c).is('unsubscribed_at', null)
  if (error) return NextResponse.json({ error: 'Could not unsubscribe you. Please try again.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// Opening the address (a person, or a mail scanner) never unsubscribes anyone: it goes to the page that asks first.
export async function GET(request: Request) {
  const u = new URL(request.url)
  return NextResponse.redirect(new URL(`/unsubscribe?c=${encodeURIComponent(u.searchParams.get('c') ?? '')}&s=${encodeURIComponent(u.searchParams.get('s') ?? '')}`, request.url))
}
