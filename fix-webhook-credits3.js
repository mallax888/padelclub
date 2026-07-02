const fs = require('fs');
let c = fs.readFileSync('app/api/stripe-webhook/route.ts', 'utf8');

const target = `    const { bookingId, userId, splitId, type } = session.metadata
    const supabase = createServerClient()

    if (type === 'split_payment' && splitId) {`;

const replacement = `    const { bookingId, userId, splitId, type, sessions } = session.metadata
    const supabase = createServerClient()

    if (type === 'credit_pack' && userId) {
      await (supabase as any).from('credit_transactions').insert({
        user_id: userId,
        amount: parseInt(sessions, 10),
        type: 'purchase',
        description: \`Purchased \${sessions}-session pack\`,
      })
      const { data: profile } = await (supabase as any).from('profiles').select('credits').eq('id', userId).single()
      await (supabase as any).from('profiles').update({ credits: (profile?.credits ?? 0) + parseInt(sessions, 10) }).eq('id', userId)
    } else if (type === 'split_payment' && splitId) {`;

console.log('Target found:', c.includes(target));
c = c.replace(target, replacement);
fs.writeFileSync('app/api/stripe-webhook/route.ts', c, 'utf8');
console.log('Webhook credit branch added:', c.includes("type === 'credit_pack'"));
