import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServerClient } from '@/lib/supabase-server'
import { MEMBERSHIP_CONFIG, type MembershipTier } from '@/types/database'
import { getAppUrl } from '@/lib/env'
import { currencyForVenueSlug, localPriceFromNzd } from '@/lib/currency'
import { getVenue } from '@/lib/venues'
import { effectivePlans } from '@/lib/plan-rules'
import { loadPlanRows } from '@/lib/club-plans'

// Buying a plan. What is charged comes from the plan the member's home club has
// set (or the standard plan if the club hasn't changed it), looked up here on the
// server, never from anything the browser sends beyond which plan was chosen.
export async function POST(request: Request) {
  try {
    const supabase = createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    const body = await request.json().catch(() => ({}))
    const planKey: string | undefined = typeof body?.planKey === 'string' ? body.planKey : typeof body?.tier === 'string' ? body.tier : undefined
    if (!planKey) return NextResponse.json({ error: 'Invalid membership plan' }, { status: 400 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('home_venue_slug')
      .eq('id', session.user.id)
      .single()
    const home: string | null = (profile as any)?.home_venue_slug ?? null
    const currency = currencyForVenueSlug(home)

    let name: string, price: number, discountPercent: number, key: string
    if (home) {
      const rows = await loadPlanRows(supabase, [home])
      const plan = effectivePlans(rows, home).find(p => p.key === planKey && p.active)
      if (!plan || plan.price <= 0) return NextResponse.json({ error: 'That plan is not available at your club.' }, { status: 400 })
      ;({ name, price, discountPercent, key } = { name: plan.name, price: plan.price, discountPercent: plan.discountPercent, key: plan.key })
    } else {
      // No home club chosen: the standard plans, priced as they always were.
      const config = MEMBERSHIP_CONFIG[planKey as MembershipTier]
      if (!config || config.priceNzd <= 0) return NextResponse.json({ error: 'Invalid membership plan' }, { status: 400 })
      ;({ name, price, discountPercent, key } = { name: config.name, price: localPriceFromNzd(config.priceNzd, currency), discountPercent: Math.round(config.discount * 100), key: config.id })
    }

    const where = home ? ` at ${getVenue(home).name}` : ''
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: `${name} membership${where}`,
              description: `1 month${discountPercent > 0 ? ` · ${discountPercent}% off court bookings${where}` : ''}`,
            },
            unit_amount: Math.round(price * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${getAppUrl(request)}/membership?payment=success`,
      cancel_url: `${getAppUrl(request)}/membership?payment=cancelled`,
      metadata: {
        type: 'membership',
        tier: key,
        userId: session.user.id,
      },
    })
    return NextResponse.json({ url: checkoutSession.url })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
