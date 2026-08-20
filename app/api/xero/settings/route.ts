import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getActiveXeroConnection } from '@/lib/xero'

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

  const { bankAccountId, bankAccountName, revenueAccountCode, revenueAccountName } = await request.json()
  if (!bankAccountId || !revenueAccountCode) {
    return NextResponse.json({ error: 'Bank account and revenue account are required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const connection = await getActiveXeroConnection(admin)
  if (!connection) {
    return NextResponse.json({ error: 'Xero is not connected' }, { status: 400 })
  }

  const { error } = await admin.from('xero_connections').update({
    bank_account_id: bankAccountId,
    bank_account_name: bankAccountName ?? null,
    revenue_account_code: revenueAccountCode,
    revenue_account_name: revenueAccountName ?? null,
    updated_at: new Date().toISOString(),
  }).eq('id', connection.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
