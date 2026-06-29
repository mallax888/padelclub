const fs = require('fs');
let c = fs.readFileSync('components/booking/BookingFlow.tsx', 'utf8');

c = c.replace(
  `    const res = await fetch('/api/create-checkout', {`,
  `    if (splitEnabled && splitPlayers.length > 0 && bookingData) {
      const splitAmount = parseFloat((courtPrice / (splitPlayers.length + 1)).toFixed(2))
      for (const pid of splitPlayers) {
        await sb.from('booking_splits').insert({
          booking_id: bookingData.id,
          invited_by: userId,
          user_id: pid,
          amount_nzd: splitAmount,
          status: 'pending',
        })
        await sb.from('notifications').insert({
          user_id: pid,
          type: 'split_request',
          title: 'Court cost split',
          message: (profile?.nickname ?? profile?.full_name ?? 'Someone') + ' is requesting ' + formatNzd(splitAmount) + ' for a court booking.',
          data: JSON.stringify({ booking_id: bookingData.id, amount: splitAmount }),
        })
      }
    }

    const res = await fetch('/api/create-checkout', {`
);

fs.writeFileSync('components/booking/BookingFlow.tsx', c, 'utf8');
console.log('Done - split before stripe:', c.indexOf('booking_splits') < c.indexOf('create-checkout') ? 'OK' : 'FAILED');
