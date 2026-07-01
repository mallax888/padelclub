const fs = require('fs');

// Fix 1: Webhook - restore split payment handling
fs.writeFileSync('app/api/stripe-webhook/route.ts', `import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServerClient } from '@/lib/supabase-server'

export async function POST(request: Request) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!
  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    return NextResponse.json({ error: \`Webhook Error: \${err.message}\` }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as any
    const { bookingId, userId, splitId, type } = session.metadata
    const supabase = createServerClient()

    if (type === 'split_payment' && splitId) {
      await (supabase as any).from('booking_splits').update({ status: 'paid', stripe_payment_id: session.payment_intent }).eq('id', splitId)
      const { data: split } = await (supabase as any)
        .from('booking_splits')
        .select('invited_by, amount_nzd, profiles!booking_splits_user_id_fkey(full_name, nickname)')
        .eq('id', splitId)
        .single()
      if (split) {
        const payerName = split.profiles?.nickname ?? split.profiles?.full_name ?? 'Someone'
        await (supabase as any).from('notifications').insert({
          user_id: split.invited_by,
          type: 'split_paid',
          title: 'Split payment received',
          message: payerName + ' paid their share of $' + split.amount_nzd,
          data: JSON.stringify({ splitId, amount: split.amount_nzd }),
        })
      }
    } else if (bookingId) {
      await (supabase as any).from('bookings').update({
        status: 'confirmed',
        payment_method: 'card',
        stripe_payment_id: session.payment_intent,
      }).eq('id', bookingId)
    }
  }

  return NextResponse.json({ received: true })
}
`, 'utf8');

// Fix 2: Split badges - remove the X icon, just show name
let mybookings = fs.readFileSync('components/booking/MyBookingsList.tsx', 'utf8');
mybookings = mybookings.replace(
  /\{splits\.map\(s => \{[\s\S]*?const name = s\.profiles\?\.nickname \?\? s\.profiles\?\.full_name \?\? 'Player'[\s\S]*?const paid = s\.status === 'paid'[\s\S]*?return \([\s\S]*?<span key=\{s\.id\}[\s\S]*?<\/span>[\s\S]*?\)\s*\}\)\}/,
  `{splits.map(s => {
          const name = s.profiles?.nickname ?? s.profiles?.full_name ?? 'Player'
          const paid = s.status === 'paid'
          return (
            <span key={s.id} className="text-xs font-medium px-2 py-0.5 rounded-full" style={{
              background: paid ? 'var(--brand-primary-muted)' : 'rgba(220,50,50,0.1)',
              color: paid ? 'var(--brand-primary)' : '#DC3232',
              border: paid ? '1px solid var(--brand-primary)' : '1px solid #DC3232',
            }}>
              {name} {paid ? '✓' : '⏳'}
            </span>
          )
        })}`
);
fs.writeFileSync('components/booking/MyBookingsList.tsx', mybookings, 'utf8');

console.log('Done');
