import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getAppUrl } from '@/lib/env'
import { getAuthenticatedXeroClient, isXeroConfigured } from '@/lib/xero'

async function requireStaff(request: Request) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
  if (!profile || !['staff', 'admin'].includes(profile.role)) return null
  return session
}

export async function GET(request: Request) {
  const session = await requireStaff(request)
  if (!session) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
  }

  if (!isXeroConfigured()) {
    return NextResponse.json({ configured: false, connected: false })
  }

  const admin = createAdminClient()
  const appUrl = getAppUrl(request)
  const result = await getAuthenticatedXeroClient(admin, appUrl)

  if (!result) {
    return NextResponse.json({ configured: true, connected: false })
  }

  const { client, tenantId, connection } = result

  // currencyCode comes along so Admin can show which currency each account
  // holds: Xero requires a bank transaction to match its account's currency,
  // so pairing the ZAR picker with an NZD account would simply fail at sync.
  let bankAccounts: { id: string; name: string; currencyCode: string | null }[] = []
  let revenueAccounts: { code: string; name: string }[] = []
  try {
    const { body } = await client.accountingApi.getAccounts(tenantId, undefined, 'Type=="BANK"')
    bankAccounts = (body.accounts ?? [])
      .filter(a => a.accountID)
      .map(a => ({
        id: a.accountID!,
        name: a.name ?? a.code ?? 'Bank account',
        currencyCode: a.currencyCode ? String(a.currencyCode) : null,
      }))
  } catch (err) {
    console.error('Failed to fetch Xero bank accounts:', err)
  }
  try {
    const { body } = await client.accountingApi.getAccounts(tenantId, undefined, 'Class=="REVENUE"')
    revenueAccounts = (body.accounts ?? [])
      .filter(a => a.code)
      .map(a => ({ code: a.code!, name: a.name ?? a.code! }))
  } catch (err) {
    console.error('Failed to fetch Xero revenue accounts:', err)
  }

  return NextResponse.json({
    configured: true,
    connected: true,
    tenantName: connection.tenant_name,
    bankAccountId: connection.bank_account_id,
    // Read off the row: these arrive with 021_xero_currency_accounts.sql and
    // types/database.ts lags until regenerated. Undefined reads as "not set".
    bankAccountIdAud: (connection as Record<string, unknown>).bank_account_id_aud ?? null,
    bankAccountIdZar: (connection as Record<string, unknown>).bank_account_id_zar ?? null,
    revenueAccountCode: connection.revenue_account_code,
    bankAccounts,
    revenueAccounts,
  })
}
