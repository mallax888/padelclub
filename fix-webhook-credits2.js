const fs = require('fs');
let c = fs.readFileSync('app/api/stripe-webhook/route.ts', 'utf8');

const hasCRLF = c.includes('\r\n');
let normalized = c.replace(/\r\n/g, '\n');

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

console.log('Target found in normalized content:', normalized.includes(target));

normalized = normalized.replace(target, replacement);

const final = hasCRLF ? normalized.replace(/\n/g, '\r\n') : normalized;
fs.writeFileSync('app/api/stripe-webhook/route.ts', final, 'utf8');
console.log('Webhook credit branch added:', final.includes("type === 'credit_pack'"));
