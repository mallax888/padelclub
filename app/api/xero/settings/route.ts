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

  const {
    bankAccountId, bankAccountName,
    bankAccountIdAud, bankAccountNameAud,
    bankAccountIdZar, bankAccountNameZar,
    revenueAccountCode, revenueAccountName,
  } = await request.json()
  // Only the NZD account is required. A club trading in one country has no
  // Australian or South African income to file anywhere.
  if (!bankAccountId || !revenueAccountCode) {
    return NextResponse.json({ error: 'Bank account and revenue account are required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const connection = await getActiveXeroConnection(admin)
  if (!connection) {
    return NextResponse.json({ error: 'Xero is not connected' }, { status: 400 })
  }

  const base = {
    bank_account_id: bankAccountId,
    bank_account_name: bankAccountName ?? null,
    revenue_account_code: revenueAccountCode,
    revenue_account_name: revenueAccountName ?? null,
    updated_at: new Date().toISOString(),
  }
  const perCurrency = {
    bank_account_id_aud: bankAccountIdAud || null,
    bank_account_name_aud: bankAccountNameAud ?? null,
    bank_account_id_zar: bankAccountIdZar || null,
    bank_account_name_zar: bankAccountNameZar ?? null,
  }

  // The per-currency columns arrive with 021_xero_currency_accounts.sql. If
  // this deploys first, writing them fails on the whole row -- which would
  // lock the club out of changing their revenue account too, over a feature
  // they may not even use. Save what the schema accepts, and report the
  // currency columns as not yet available rather than failing outright.
  let { error } = await admin
    .from('xero_connections')
    .update({ ...base, ...perCurrency } as any)
    .eq('id', connection.id)

  let currencyAccountsSaved = !error
  if (error) {
    console.error('Could not save per-currency Xero accounts (has migration 021 run?):', error)
    ;({ error } = await admin.from('xero_connections').update(base).eq('id', connection.id))
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true, currencyAccountsSaved })
}
