import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { CLUB_COOKIE, isLiveClub } from '@/lib/club-link'

// A new player finished sign-up after opening a club's booking link: remember which club brought them.
// Set once and never changed, so an old link cannot re-tag someone who already belongs somewhere.
export async function POST() {
  const { data: { session } } = await createServerClient().auth.getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const slug = cookies().get(CLUB_COOKIE)?.value
  if (!isLiveClub(slug)) return NextResponse.json({ ok: true, tagged: false })
  const admin = createAdminClient() as any
  const { data, error } = await admin.from('profiles').update({ joined_via_venue: slug }).eq('id', session.user.id).is('joined_via_venue', null).select('id')
  // Until the database change is run the column does not exist; that must never get in the way of signing up.
  if (error) return NextResponse.json({ ok: true, tagged: false })
  const res = NextResponse.json({ ok: true, tagged: ((data ?? []) as any[]).length > 0 })
  res.cookies.set(CLUB_COOKIE, '', { path: '/', maxAge: 0 })
  return res
}
