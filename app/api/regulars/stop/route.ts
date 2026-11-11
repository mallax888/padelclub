import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { stopRegular } from '@/lib/regulars'

// Stop one of your own regulars. Unpaid weeks still to come are let go; weeks
// you have already paid for are kept.
export async function POST(request: Request) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  if (typeof body?.id !== 'string') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })

  const result = await stopRegular(createAdminClient(), { userId: session.user.id, regularId: body.id })
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ ok: true, released: result.released, keptPaid: result.keptPaid })
}
