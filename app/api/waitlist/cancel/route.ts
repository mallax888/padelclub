import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

// Stop waiting for a time. Your own waits only.
export async function POST(request: Request) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  if (typeof body?.id !== 'string') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })

  const { data, error } = await (createAdminClient() as any).from('waitlist')
    .update({ status: 'cancelled' }).eq('id', body.id).eq('user_id', session.user.id).in('status', ['waiting', 'notified']).select('id').maybeSingle()
  if (error) return NextResponse.json({ error: 'Could not save. Please try again.' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'That wait is already finished.' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
