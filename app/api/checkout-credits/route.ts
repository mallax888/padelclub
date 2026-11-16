import { NextResponse } from 'next/server'
import { createCheckout, paymentTarget } from '@/lib/club-payments'
import { createAdminClient } from '@/lib/supabase-admin'
import { createServerClient } from '@/lib/supabase-server'
import { CREDIT_PACKS } from '@/lib/creditPacks'
import { getAppUrl } from '@/lib/env'
import { currencyForVenueSlug, localPriceFromNzd } from '@/lib/currency'

export async function POST(request: Request) {
  try {
    const supabase = createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    const { packId } = await request.json()
    const pack = CREDIT_PACKS.find(p => p.id === packId)
    if (!pack) {
      return NextResponse.json({ error: 'Unknown credit pack' }, { status: 400 })
    }
    // Charged in the member's own currency at that country's price -- see
    // localPriceFromNzd. Everyone used to be billed New Zealand dollars,
    // which a South African bank then converted at roughly eleven to one.
    //
    // home_venue_slug is set during onboarding; a member who skipped that
    // step has none and falls back to NZD.
    const { data: profile } = await supabase
      .from('profiles')
      .select('home_venue_slug')
      .eq('id', session.user.id)
      .single()
    const currency = currencyForVenueSlug(profile?.home_venue_slug)
    const unitAmount = Math.round(localPriceFromNzd(pack.priceNzd, currency) * 100)

    // A club that is paid directly gets this payment too (the member's home club); otherwise it
    // goes to PadelClub's own account as before.
    const target = await paymentTarget(createAdminClient(), profile?.home_venue_slug, unitAmount)
    const checkoutSession = await createCheckout({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: `${pack.sessions}-session credit pack`,
              description: 'PadelClub session credits — use any time, on any court',
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${getAppUrl(request)}/membership?payment=success`,
      cancel_url: `${getAppUrl(request)}/membership?payment=cancelled`,
      metadata: {
        type: 'credit_pack',
        packId: pack.id,
        sessions: String(pack.sessions),
        userId: session.user.id,
      },
    }, target)
    return NextResponse.json({ url: checkoutSession.url })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
