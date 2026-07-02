const fs = require('fs');
const path = 'components/booking/MyBookingsList.tsx';
const c = fs.readFileSync(path, 'utf8');

const idx = c.indexOf('const handleCancel');
const endMarker = 'setCancelling(null)\n  }';
const end = c.indexOf(endMarker, idx) + endMarker.length;

const replacement = `const handleCancel = async (id: string) => {
    const booking = bookings.find(b => b.id === id)
    if (!booking) return
    const bookingDateTime = new Date(\`\${booking.date}T\${booking.start_time}\`)
    const now = new Date()
    const hoursUntil = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60)
    const isPaid = !!(booking as any).stripe_payment_id
    const policy = !isPaid
      ? 'Cancel this booking?\\n\\nNo payment has been charged yet, so this will simply be cancelled with no charge or credit.'
      : hoursUntil >= 24
      ? 'Cancel this booking?\\n\\nSince it is more than 24 hours away you will receive a FULL REFUND to your card within 5-10 business days.'
      : 'Cancel this booking?\\n\\nSince it is less than 24 hours away you will only receive 50% back (' + formatNzd(booking.price_nzd * 0.5) + ') as account credit.'
    if (!confirm(policy)) return
    setCancelling(id)
    const { error } = await (supabase as any).from('bookings').update({ status: 'cancelled' }).eq('id', id)
    if (error) {
      toast.error('Could not cancel — please try again.')
    } else {
      if (!isPaid) {
        toast.success('Booking cancelled.')
      } else if (hoursUntil < 24) {
        const creditAmount = Math.round(booking.price_nzd * 0.5)
        await (supabase as any).from('profiles').update({ credits: (profile?.credits ?? 0) + creditAmount }).eq('id', profile?.id)
        toast.success('Booking cancelled. ' + formatNzd(creditAmount) + ' credit added to your account.')
      } else {
        toast.success('Booking cancelled. Full refund will appear on your card in 5-10 business days.')
      }
      router.refresh()
    }
    setCancelling(null)
  }`;

console.log('Boundaries found:', idx !== -1 && end !== -1);
const newContent = c.slice(0, idx) + replacement + c.slice(end);
fs.writeFileSync(path, newContent, 'utf8');
console.log('isPaid check present:', newContent.includes('const isPaid = !!(booking as any).stripe_payment_id'));
console.log('No-payment message present:', newContent.includes('No payment has been charged yet'));
