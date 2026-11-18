// Server-only: where a card payment goes. A club that has finished connecting Stripe is paid
// directly (a direct charge on its own account, PadelClub's fee taken as it happens); every
// other payment goes to PadelClub's own Stripe account exactly as before. The rules live in
// lib/connect-rules.ts; this file is the part that touches Stripe and the database.
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase-admin'
import { COUNTRIES, getVenue } from '@/lib/venues'
import { applicationFeeCents, canTakePayments, connectOn, DEFAULT_FEE, type AccountRow, type FeeSetting } from '@/lib/connect-rules'

export type StoredAccount = NonNullable<AccountRow> & { venue_slug: string; fee_percent: number; fee_fixed: number }

// The club's stored account, or null when it hasn't started connecting (or the 034 database
// change hasn't been run, in which case nothing about Connect is active).
export async function loadClubAccount(admin: any, venueSlug: string | null | undefined): Promise<StoredAccount | null> {
  if (!venueSlug) return null
  const { data, error } = await admin.from('club_stripe_accounts').select('*').eq('venue_slug', venueSlug).maybeSingle()
  if (error || !data) return null
  return { ...data, fee_percent: Number(data.fee_percent), fee_fixed: Number(data.fee_fixed), requirements_due: data.requirements_due ?? [] } as StoredAccount
}

export const feeOf = (a: Pick<StoredAccount, 'fee_percent' | 'fee_fixed'> | null): FeeSetting =>
  a ? { percent: a.fee_percent, fixed: a.fee_fixed } : DEFAULT_FEE

export type PaymentTarget = { account: string; venueSlug: string; feeCents: number }

// Who gets paid for a payment of this size at this club. Null = PadelClub's own account.
export async function paymentTarget(admin: any, venueSlug: string | null | undefined, amountCents: number): Promise<PaymentTarget | null> {
  if (!connectOn()) return null
  const row = await loadClubAccount(admin, venueSlug)
  if (!row || !canTakePayments(row)) return null
  return { account: row.stripe_account_id, venueSlug: row.venue_slug, feeCents: applicationFeeCents(amountCents, feeOf(row)) }
}

// One place every Checkout Session is opened, so no route can forget the club's account.
export async function createCheckout(params: Stripe.Checkout.SessionCreateParams, target: PaymentTarget | null) {
  if (!target) return stripe.checkout.sessions.create(params)
  return stripe.checkout.sessions.create(
    {
      ...params,
      metadata: { ...(params.metadata ?? {}), club: target.venueSlug },
      payment_intent_data: { ...(params.payment_intent_data ?? {}), ...(target.feeCents > 0 ? { application_fee_amount: target.feeCents } : {}) },
    },
    { stripeAccount: target.account },
  )
}

// The account a payment was made on, for refunds. Null = PadelClub's own account.
export async function accountForIntent(paymentIntentId: string): Promise<string | null> {
  try {
    const admin = createAdminClient() as any
    const { data } = await admin.from('payment_accounts').select('stripe_account').eq('payment_intent', paymentIntentId).maybeSingle()
    return data?.stripe_account ?? null
  } catch {
    return null
  }
}

// The country a club is in, by name, for Stripe's account country.
export function countryNameOfVenue(venueSlug: string): string | null {
  const region = getVenue(venueSlug).region
  return COUNTRIES.find(c => c.regions.includes(region))?.name ?? null
}

// What Stripe says about a club's account, in the few facts the app needs.
export type AccountFacts = { details_submitted: boolean; charges_enabled: boolean; payouts_enabled: boolean; requirements_due: string[] }

// Club accounts are made with Stripe's Accounts v2 API (Stripe no longer lets new Connect platforms create them the old way), so
// they are read the same way: card payments "active" means the club can be paid, and whatever is still waiting on the club is
// "due". An older account made the previous way is still read the previous way.
export async function readAccount(accountId: string): Promise<AccountFacts> {
  try {
    const a = await stripe.v2.core.accounts.retrieve(accountId, { include: ['configuration.merchant', 'requirements'] })
    const cap: any = (a as any).configuration?.merchant?.capabilities
    const due = (((a as any).requirements?.entries ?? []) as any[])
      .filter(e => e?.awaiting_action_from === 'user')
      .map(e => String(e?.description ?? '')).filter(Boolean)
    return {
      details_submitted: due.length === 0,
      charges_enabled: cap?.card_payments?.status === 'active',
      payouts_enabled: cap?.stripe_balance?.payouts?.status === 'active',
      requirements_due: due,
    }
  } catch (err: any) {
    if (err?.statusCode && err.statusCode !== 404 && err.statusCode !== 400) throw err
    const v1 = await stripe.accounts.retrieve(accountId)
    return { details_submitted: !!v1.details_submitted, charges_enabled: !!v1.charges_enabled, payouts_enabled: !!v1.payouts_enabled, requirements_due: v1.requirements?.currently_due ?? [] }
  }
}

// Copy what Stripe says about an account into our row. Returns the fresh row.
export async function syncAccount(admin: any, venueSlug: string, account: AccountFacts | Stripe.Account) {
  const facts: AccountFacts = 'requirements_due' in account ? account : {
    details_submitted: !!account.details_submitted, charges_enabled: !!account.charges_enabled,
    payouts_enabled: !!account.payouts_enabled, requirements_due: account.requirements?.currently_due ?? [],
  }
  const patch = { ...facts, updated_at: new Date().toISOString() }
  await admin.from('club_stripe_accounts').update(patch).eq('venue_slug', venueSlug)
  return patch
}

// Remember that this payment went to a club's account, with what it cost. Called from the
// webhook for every club payment, before anything else acts on it. Safe to repeat.
export async function recordConnectPayment(admin: any, stripeAccount: string, session: any) {
  const pi: string | null = typeof session?.payment_intent === 'string' ? session.payment_intent : null
  if (!pi) return
  let appFee = 0, stripeFee: number | null = null
  try {
    const intent: any = await stripe.paymentIntents.retrieve(pi, { expand: ['latest_charge.balance_transaction'] }, { stripeAccount })
    appFee = Number(intent.application_fee_amount) || 0
    const bt = intent.latest_charge?.balance_transaction
    if (bt && typeof bt === 'object') {
      // The balance transaction's fee includes the application fee on the club's side; what
      // Stripe itself charged is the rest.
      const feeDetails: any[] = bt.fee_details ?? []
      const stripeOnly = feeDetails.filter(f => f.type === 'stripe_fee').reduce((a, f) => a + f.amount, 0)
      stripeFee = feeDetails.length ? stripeOnly : null
    }
  } catch (err) {
    console.error('Could not read fees for club payment', pi, err)
  }
  const { error } = await admin.from('payment_accounts').upsert({
    payment_intent: pi, stripe_account: stripeAccount, venue_slug: session.metadata?.club ?? null,
    paid_cents: Number(session.amount_total) || 0, app_fee_cents: appFee, stripe_fee_cents: stripeFee,
  }, { onConflict: 'payment_intent' })
  if (error) console.error('Could not record club payment', pi, error)
}
