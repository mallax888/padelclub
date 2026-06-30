const fs = require('fs');

// Create new API route for split payments
fs.mkdirSync('app/api/pay-split', { recursive: true });
fs.writeFileSync('app/api/pay-split/route.ts', `import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServerClient } from '@/lib/supabase-server'

export async function POST(request: Request) {
  try {
    const supabase = createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { splitId, amount, courtName, date, time, invitedByName } = await request.json()

    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'nzd',
            product_data: {
              name: \`Court split — \${courtName}\`,
              description: \`\${date} · \${time} · Requested by \${invitedByName}\`,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: \`\${process.env.NEXT_PUBLIC_APP_URL}/mybookings?split=paid\`,
      cancel_url: \`\${process.env.NEXT_PUBLIC_APP_URL}/mybookings?split=cancelled\`,
      metadata: {
        splitId,
        userId: session.user.id,
        type: 'split_payment',
      },
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
`, 'utf8');

// Update MyBookingsList to wire up Pay button
let c = fs.readFileSync('components/booking/MyBookingsList.tsx', 'utf8');

// Add paying state
c = c.replace(
  "const [cancelling, setCancelling] = useState<string | null>(null)",
  "const [cancelling, setCancelling] = useState<string | null>(null)\n  const [payingSplit, setPayingSplit] = useState<string | null>(null)"
);

// Replace the alert placeholder with real Stripe redirect
c = c.replace(
  `                  <button
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg shrink-0"
                    style={{ background: '#DC3232', color: '#fff' }}
                    onClick={() => alert('Stripe payment coming soon!')}
                  >
                    Pay {formatNzd(s.amount_nzd)}
                  </button>`,
  `                  <button
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg shrink-0"
                    style={{ background: '#DC3232', color: '#fff' }}
                    disabled={payingSplit === s.id}
                    onClick={async () => {
                      setPayingSplit(s.id)
                      const court = s.bookings?.courts?.name ?? 'Court'
                      const date = s.bookings?.date ?? ''
                      const time = s.bookings?.start_time?.slice(0,5) ?? ''
                      const invitedByName = s.profiles?.nickname ?? s.profiles?.full_name ?? 'Someone'
                      const res = await fetch('/api/pay-split', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ splitId: s.id, amount: s.amount_nzd, courtName: court, date, time, invitedByName }),
                      })
                      const { url, error } = await res.json()
                      if (error) { toast.error(error); setPayingSplit(null); return }
                      window.location.href = url
                    }}
                  >
                    {payingSplit === s.id ? 'Loading...' : \`Pay \${formatNzd(s.amount_nzd)}\`}
                  </button>`
);

fs.writeFileSync('components/booking/MyBookingsList.tsx', c, 'utf8');
console.log('Done');
