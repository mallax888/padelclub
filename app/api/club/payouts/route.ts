import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase-admin'
import { loadTeamCaller } from '@/lib/team-server'
import { covers } from '@/lib/team'
import { VENUES, getVenue } from '@/lib/venues'
import { getAppUrl } from '@/lib/env'
import { currencyForVenueSlug } from '@/lib/currency'
import { connectOn, connectState, describeDue, stripeCountry, DEFAULT_FEE_PERCENT } from '@/lib/connect-rules'
import { countryNameOfVenue, feeOf, loadClubAccount, readAccount, syncAccount } from '@/lib/club-payments'

// An owner connecting their club to Stripe, and seeing how payouts are going. Owners only,
// inside their own reach. Stripe holds the identity and bank details; we only keep the
// account id and what Stripe says the account can do.

async function ownerFor(slug: unknown) {
  const caller = await loadTeamCaller()
  if (!caller) return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) }
  if (caller.role !== 'admin') return { error: NextResponse.json({ error: 'Only an owner can set up payouts.' }, { status: 403 }) }
  if (typeof slug !== 'string' || !VENUES.some(v => v.slug === slug)) return { error: NextResponse.json({ error: 'Unknown club.' }, { status: 400 }) }
  if (!covers(caller.reach, { kind: 'club', venueSlug: slug })) return { error: NextResponse.json({ error: 'That club is outside your reach.' }, { status: 403 }) }
  return { caller, slug }
}

const notReady = () => NextResponse.json({ error: "Direct payouts aren't switched on yet. PadelClub has to finish a one-off Stripe set-up first." }, { status: 503 })

// What the card shows: state, what is missing, the fee, and (once connected) money figures.
export async function GET(request: Request) {
  const who = await ownerFor(new URL(request.url).searchParams.get('venueSlug'))
  if ('error' in who) return who.error
  const slug = who.slug as string
  const currency = currencyForVenueSlug(slug)
  const country = countryNameOfVenue(slug)
  const supported = stripeCountry(country) !== null
  const admin = createAdminClient() as any

  const probe = await admin.from('club_stripe_accounts').select('venue_slug').limit(1)
  const dbReady = !probe.error
  const base = { on: connectOn() && dbReady, supported, country, currency }
  let row = dbReady ? await loadClubAccount(admin, slug) : null
  if (!row) return NextResponse.json({ ...base, state: 'not_started', due: [], fee: feeOf(null) })

  // Ask Stripe for the truth every time the card is opened, so "Connected" is never stale.
  let live = true
  try {
    const account = await readAccount(row.stripe_account_id)
    const patch = await syncAccount(admin, slug, account)
    row = { ...row, ...patch }
  } catch (err) {
    console.error('Could not read Stripe account for', slug, err)
    live = false
  }
  const state = connectState(row)
  const out: any = { ...base, state, due: describeDue(row.requirements_due), fee: feeOf(row), live, payoutsEnabled: row.payouts_enabled }

  if (state === 'ready' && live) {
    try {
      const opts = { stripeAccount: row.stripe_account_id }
      const [balance, payouts] = await Promise.all([stripe.balance.retrieve(undefined, opts), stripe.payouts.list({ limit: 6 }, opts)])
      const sum = (xs: { amount: number }[]) => xs.reduce((a, x) => a + x.amount, 0)
      const inPending = payouts.data.filter(p => p.status === 'pending' || p.status === 'in_transit')
      out.money = {
        availableCents: sum(balance.available), pendingCents: sum(balance.pending),
        onItsWayCents: sum(inPending),
        nextPayoutDate: inPending.map(p => p.arrival_date).sort()[0] ?? null,
        recent: payouts.data.map(p => ({ id: p.id, amountCents: p.amount, date: p.arrival_date, status: p.status })),
      }
    } catch (err) {
      console.error('Could not read Stripe balance for', slug, err)
    }
  }
  return NextResponse.json(out)
}

// "Connect with Stripe" / "Continue on Stripe": makes the club's account the first time,
// then hands back Stripe's own short form, which sends the owner back here when done.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const who = await ownerFor(body?.venueSlug)
  if ('error' in who) return who.error
  const slug = who.slug as string
  if (!connectOn()) return notReady()

  const country = stripeCountry(countryNameOfVenue(slug))
  const admin = createAdminClient() as any
  const probe = await admin.from('club_stripe_accounts').select('venue_slug').limit(1)
  if (probe.error) return NextResponse.json({ error: "Direct payouts aren't switched on yet. Run the 034 database change first." }, { status: 503 })

  try {
    let row = await loadClubAccount(admin, slug)
    if (row && row.charges_enabled) return NextResponse.json({ error: 'This club is already connected to Stripe.' }, { status: 409 })
    if (!row) {
      if (!country) return NextResponse.json({ error: `Stripe isn't available for clubs in ${countryNameOfVenue(slug) ?? 'this country'} yet. We will tell you when it is.` }, { status: 400 })
      const account = await stripe.v2.core.accounts.create({
        display_name: getVenue(slug).name,
        dashboard: 'full',
        identity: { country: country.toLowerCase() },
        configuration: { merchant: { capabilities: { card_payments: { requested: true } } } },
        defaults: { currency: currencyForVenueSlug(slug).toLowerCase(), responsibilities: { fees_collector: 'stripe', losses_collector: 'stripe' } },
        metadata: { venue_slug: slug },
      })
      const { error } = await admin.from('club_stripe_accounts').insert({ venue_slug: slug, stripe_account_id: account.id, fee_percent: DEFAULT_FEE_PERCENT })
      if (error) {
        // Two taps at once: another request made the row first. Use that one.
        row = await loadClubAccount(admin, slug)
        if (!row) return NextResponse.json({ error: 'Could not start the Stripe set-up. Please try again.' }, { status: 500 })
      }
      row = row ?? (await loadClubAccount(admin, slug))
    }
    const back = `${getAppUrl(request)}/admin/setup?venue=${encodeURIComponent(slug)}`
    const link = await stripe.v2.core.accountLinks.create({
      account: row!.stripe_account_id,
      use_case: { type: 'account_onboarding', account_onboarding: { configurations: ['merchant'], return_url: `${back}&stripe=return`, refresh_url: `${back}&stripe=refresh` } },
    })
    return NextResponse.json({ url: link.url })
  } catch (err: any) {
    console.error('Stripe connect failed for', slug, err)
    const msg = String(err?.message ?? '')
    if (/signed up for Connect|Connect/i.test(msg) && /sign/i.test(msg)) {
      return NextResponse.json({ error: "Stripe Connect hasn't been turned on for PadelClub's Stripe account yet." }, { status: 503 })
    }
    // The exact reason from Stripe is shown to the owner who pressed the button, next to a plain
    // sentence. It holds no keys or bank details, and during set-up the person pressing it is
    // usually the one who has to fix it. (Tighten this back to platform admins at go-live.)
    const detail = `${err?.type ?? 'Error'}: ${msg}`.slice(0, 300)
    // The one-off Stripe step that stops accounts being created: who covers losses on club accounts.
    if (/managing losses|platform[- ]profile/i.test(msg)) {
      return NextResponse.json({ error: "PadelClub still has one Stripe setting to finish (who covers losses on club accounts). PadelClub needs to fix this.", detail }, { status: 503 })
    }
    if (err?.type === 'StripeAuthenticationError') {
      return NextResponse.json({ error: "Stripe didn't accept PadelClub's connection key. PadelClub needs to fix this.", detail }, { status: 502 })
    }
    if (err?.type === 'StripePermissionError') {
      return NextResponse.json({ error: "PadelClub's Stripe key isn't allowed to set up club accounts. PadelClub needs to fix this.", detail }, { status: 502 })
    }
    return NextResponse.json({ error: 'Stripe could not start the set-up. Please try again in a moment.', detail }, { status: 502 })
  }
}
