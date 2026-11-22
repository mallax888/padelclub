// How a club gets paid through Stripe, as pure rules (no database, no Stripe, no React) so
// they are tested on their own.
//   * Each club connects its OWN Stripe account (a "Standard" account). A player's card
//     payment goes straight to that account, so PadelMate never holds the club's money.
//   * PadelMate's fee is taken from each payment as it happens: a percentage, plus an
//     optional fixed amount. The club pays Stripe's own card fee, refunds and chargebacks
//     (that is how a direct charge works), so those are not our fee.
//   * Until a club has connected, and until the switch below is on, payments work exactly
//     as they did before.

// ---------------------------------------------------------------- the switch
// Connect is switched on by setting STRIPE_CONNECT_WEBHOOK_SECRET: the signing secret of the
// second Stripe webhook that listens to connected accounts. Without it a club payment could
// complete in Stripe and never reach the app, so we never take one.
export const connectOn = (env: Record<string, string | undefined> = process.env): boolean =>
  !!(env.STRIPE_CONNECT_WEBHOOK_SECRET && env.STRIPE_CONNECT_WEBHOOK_SECRET.length > 0)

// ---------------------------------------------------------------- the fee
export const DEFAULT_FEE_PERCENT = 3
export const MAX_FEE_PERCENT = 20
export const MAX_FEE_FIXED = 5 // per payment, in the club's own currency

export type FeeSetting = { percent: number; fixed: number }
export const DEFAULT_FEE: FeeSetting = { percent: DEFAULT_FEE_PERCENT, fixed: 0 }

export type FeeResult = { ok: true; value: FeeSetting } | { ok: false; error: string }
export function validateFee(percent: unknown, fixed: unknown): FeeResult {
  const p = Number(percent), f = Number(fixed ?? 0)
  if (percent === '' || percent === null || percent === undefined || !Number.isFinite(p) || p < 0 || p > MAX_FEE_PERCENT) {
    return { ok: false, error: `Enter a fee between 0% and ${MAX_FEE_PERCENT}%.` }
  }
  if (!Number.isFinite(f) || f < 0 || f > MAX_FEE_FIXED) return { ok: false, error: `Enter a fixed amount between 0 and ${MAX_FEE_FIXED}.` }
  return { ok: true, value: { percent: Math.round(p * 100) / 100, fixed: Math.round(f * 100) / 100 } }
}

// PadelMate's fee on one payment, in cents. Never more than the payment itself, never negative.
export function applicationFeeCents(amountCents: number, fee: FeeSetting = DEFAULT_FEE): number {
  const amount = Math.max(0, Math.round(amountCents))
  const raw = Math.round((amount * fee.percent) / 100) + Math.round(fee.fixed * 100)
  return Math.max(0, Math.min(raw, amount))
}

// What the club ends up with from one payment, given what Stripe really charged them.
export function clubReceivesCents(paidCents: number, appFeeCents: number, stripeFeeCents: number): number {
  return Math.round(paidCents) - Math.round(appFeeCents) - Math.round(stripeFeeCents)
}

// ---------------------------------------------------------------- where Stripe works
// Stripe accounts can be opened in New Zealand and Australia today. South Africa has to be
// checked with Stripe before it is promised, so a South African club sees a plain message.
export function stripeCountry(countryName: string | null | undefined): 'NZ' | 'AU' | null {
  if (countryName === 'New Zealand') return 'NZ'
  if (countryName === 'Australia') return 'AU'
  return null
}

// ---------------------------------------------------------------- account state
export type AccountRow = {
  stripe_account_id: string
  details_submitted: boolean
  charges_enabled: boolean
  payouts_enabled: boolean
  requirements_due: string[] | null
} | null

export type ConnectState = 'not_started' | 'needs_info' | 'checking' | 'ready'

// not_started: no account yet. needs_info: Stripe still needs something from the owner.
// checking: everything is in and Stripe is reviewing. ready: payments can go to the club.
export function connectState(row: AccountRow): ConnectState {
  if (!row) return 'not_started'
  if (row.charges_enabled) return 'ready'
  if (!row.details_submitted || (row.requirements_due ?? []).length > 0) return 'needs_info'
  return 'checking'
}

// Only a club whose Stripe account can take card payments is ever paid directly.
export const canTakePayments = (row: AccountRow): boolean => !!row && row.charges_enabled

const DUE_WORDS: [RegExp, string][] = [
  [/external_account|bank/, 'Bank account'],
  [/verification|document|identity|dob|id_number|person/, 'Photo ID for the account holder'],
  [/business_profile|company|business_type|tos_acceptance|representative|owner|director/, 'Business details'],
  [/email|phone|address/, 'Contact details'],
]
// Stripe's list of what is missing, in plain words, each named once.
export function describeDue(due: string[] | null | undefined): string[] {
  const out: string[] = []
  for (const key of due ?? []) {
    const words = DUE_WORDS.find(([re]) => re.test(key))?.[1] ?? 'A few more details'
    if (!out.includes(words)) out.push(words)
  }
  return out
}

// ---------------------------------------------------------------- refunds
// A refund of a direct charge is taken from the club's own balance, and PadelMate gives its
// fee back with it, so the club is made whole.
export const REFUND_APPLICATION_FEE = true
