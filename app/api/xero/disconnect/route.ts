import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

export async function POST(request: Request) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
  if (!profile || !['staff', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
  }

  const admin = createAdminClient()
  // Forgets the stored tokens on our side. This doesn't revoke access on
  // Xero's end -- if that's wanted too, remove the app from Connected Apps
  // in the Xero organisation's own settings.
  await admin.from('xero_connections').delete().not('id', 'is', null)

  return NextResponse.json({ success: true })
}
