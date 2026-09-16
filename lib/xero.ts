import { XeroClient, BankTransaction, CurrencyCode as XeroCurrencyCode } from 'xero-node'
import type { CurrencyCode } from '@/lib/currency'
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

// Which Xero bank account a payment belongs in, by the currency it was
// actually charged in. Xero requires a bank transaction to be in its bank
// account's currency -- there is no posting rand into a New Zealand dollar
// account -- so each currency the club trades in needs its own account,
// configured in Admin → Xero.
//
// Returns null when the club hasn't set one up for that currency, which is
// the normal state for a club trading in one country.
function bankAccountForCurrency(
  connection: XeroConnection,
  currency: CurrencyCode,
): string | null {
  // Read off the row rather than through the generated types: these columns
  // arrive with 021_xero_currency_accounts.sql, and types/database.ts lags a
  // migration until it's regenerated. Undefined here reads the same as an
  // unconfigured account, so a deploy that lands before the migration syncs
  // NZD as it always did and skips the rest.
  const row = connection as Record<string, unknown>
  const id =
    currency === 'aud' ? row.bank_account_id_aud
    : currency === 'zar' ? row.bank_account_id_zar
    : connection.bank_account_id
  return typeof id === 'string' && id.length > 0 ? id : null
}

// Pushes a single payment into Xero as a "Receive Money" bank transaction
// against the bank account configured for that payment's currency, with the
// amount coded to the configured revenue account. Never throws -- a Xero
// outage or missing setup should never take down the payment flow calling it.
export async function syncReceiveMoneyToXero(admin: SupabaseClient<Database>, appUrl: string, params: {
  // The amount actually charged, in the currency actually charged. This was
  // once called amountNzd and was handed Stripe's amount_total regardless of
  // currency, so a R490 payment went into the books as the number 490 against
  // an NZD account -- overstating Australian and South African revenue for as
  // long as those venues have been taking bookings.
  amount: number
  currency: CurrencyCode
  description: string
  reference: string
  contactName?: string | null
  idempotencyKey: string
}) {
  try {
    const result = await getAuthenticatedXeroClient(admin, appUrl)
    if (!result) return
    const { client, tenantId, connection } = result

    if (!connection.revenue_account_code) {
      console.error('Xero is connected but no revenue account is configured — skipping sync')
      return
    }

    const bankAccountId = bankAccountForCurrency(connection, params.currency)
    if (!bankAccountId) {
      // Deliberately not falling back to the default account: posting this
      // into an account of another currency is exactly the bug being fixed
      // here. Better an absent transaction the club can see missing than a
      // present one whose number is wrong.
      console.error(
        `Xero has no ${params.currency.toUpperCase()} bank account configured — skipping sync of ${params.reference}. ` +
        'Set one in Admin → Xero to record this currency.',
      )
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
            unitAmount: params.amount,
            accountCode: connection.revenue_account_code,
          }],
          bankAccount: { accountID: bankAccountId },
          // Stated explicitly rather than left to Xero's default of the
          // organisation's base currency, which is how a rand amount came to
          // be filed as New Zealand dollars.
          currencyCode: XeroCurrencyCode[params.currency.toUpperCase() as keyof typeof XeroCurrencyCode],
          reference: params.reference,
          // UTC's date, which is still yesterday's for the first hours of a
          // New Zealand day, so a handful of transactions a year land in the
          // previous period. Left as is deliberately rather than overlooked:
          // the right date is the one in the Xero organisation's own
          // timezone, and nothing here knows it. This function also syncs
          // memberships and credit packs, which have no venue to infer a
          // timezone from, and xero_connections doesn't record the org's.
          // Worth revisiting if it ever does.
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
