import { XeroClient, BankTransaction } from 'xero-node'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const SCOPES = [
  'openid',
  'profile',
  'email',
  'accounting.transactions',
  'accounting.settings.read',
  'accounting.contacts',
  'offline_access',
]

function getXeroCredentials() {
  const clientId = process.env.XERO_CLIENT_ID
  const clientSecret = process.env.XERO_CLIENT_SECRET
  if (!clientId || !clientSecret) return null
  return { clientId, clientSecret }
}

export function isXeroConfigured() {
  return getXeroCredentials() !== null
}

export function buildXeroRedirectUri(appUrl: string) {
  return `${appUrl}/api/xero/callback`
}

// Used for the initial "Connect Xero" / OAuth callback leg -- no stored
// tokens yet.
export async function getXeroConsentClient(appUrl: string) {
  const creds = getXeroCredentials()
  if (!creds) return null
  const client = new XeroClient({
    clientId: creds.clientId,
    clientSecret: creds.clientSecret,
    redirectUris: [buildXeroRedirectUri(appUrl)],
    scopes: SCOPES,
  })
  await client.initialize()
  return client
}

export type XeroConnection = Database['public']['Tables']['xero_connections']['Row']

export async function getActiveXeroConnection(admin: SupabaseClient<Database>): Promise<XeroConnection | null> {
  const { data } = await admin.from('xero_connections').select('*').limit(1).maybeSingle()
  return data
}

// Rehydrates a XeroClient from the stored connection, refreshing (and
// persisting) the access token first if it's expired or about to be.
export async function getAuthenticatedXeroClient(admin: SupabaseClient<Database>, appUrl: string) {
  const creds = getXeroCredentials()
  if (!creds) return null
  const connection = await getActiveXeroConnection(admin)
  if (!connection) return null

  const client = new XeroClient({
    clientId: creds.clientId,
    clientSecret: creds.clientSecret,
    redirectUris: [buildXeroRedirectUri(appUrl)],
    scopes: SCOPES,
  })
  await client.initialize()
  client.setTokenSet({
    access_token: connection.access_token,
    refresh_token: connection.refresh_token,
    expires_at: Math.floor(new Date(connection.expires_at).getTime() / 1000),
  })

  let activeConnection = connection
  if (new Date(connection.expires_at).getTime() < Date.now() + 60_000) {
    const refreshed = await client.refreshWithRefreshToken(creds.clientId, creds.clientSecret, connection.refresh_token)
    const expiresAt = new Date(Date.now() + (refreshed.expires_in ?? 1800) * 1000).toISOString()
    await admin.from('xero_connections').update({
      access_token: refreshed.access_token!,
      refresh_token: refreshed.refresh_token ?? connection.refresh_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    }).eq('id', connection.id)
    activeConnection = { ...connection, access_token: refreshed.access_token!, expires_at: expiresAt }
  }

  return { client, tenantId: activeConnection.tenant_id, connection: activeConnection }
}

// Pushes a single payment into Xero as a "Receive Money" bank transaction
// against the club's configured bank account, with the amount coded to the
// configured revenue account. Never throws -- a Xero outage or missing
// setup should never take down the payment flow that calls this.
export async function syncReceiveMoneyToXero(admin: SupabaseClient<Database>, appUrl: string, params: {
  amountNzd: number
  description: string
  reference: string
  contactName?: string | null
  idempotencyKey: string
}) {
  try {
    const result = await getAuthenticatedXeroClient(admin, appUrl)
    if (!result) return
    const { client, tenantId, connection } = result

    if (!connection.bank_account_id || !connection.revenue_account_code) {
      console.error('Xero is connected but no bank account / revenue account is configured — skipping sync')
      return
    }

    await client.accountingApi.createBankTransactions(
      tenantId,
      {
        bankTransactions: [{
          type: BankTransaction.TypeEnum.RECEIVE,
          contact: params.contactName ? { name: params.contactName } : undefined,
          lineItems: [{
            description: params.description,
            quantity: 1,
            unitAmount: params.amountNzd,
            accountCode: connection.revenue_account_code,
          }],
          bankAccount: { accountID: connection.bank_account_id },
          reference: params.reference,
          date: new Date().toISOString().slice(0, 10),
        }],
      },
      undefined,
      undefined,
      params.idempotencyKey
    )
  } catch (err) {
    console.error('Xero sync failed:', err)
  }
}
