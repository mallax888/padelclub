const fs = require('fs');
const c = fs.readFileSync('components/membership/MembershipPanel.tsx', 'utf8');

const idx = c.indexOf('const handlePurchase');
const endMarker = "setPurchasing(false)\n  }";
const end = c.indexOf(endMarker, idx) + endMarker.length;

if (idx === -1 || end === -1) {
  console.log('Could not locate handlePurchase boundaries. idx:', idx, 'end:', end);
  process.exit(1);
}

const replacement = `const handlePurchase = async () => {
    if (!selectedPack) return
    const pack = CREDIT_PACKS.find(p => p.id === selectedPack)!
    setPurchasing(true)
    try {
      const res = await fetch('/api/checkout-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId: pack.id, sessions: pack.sessions, priceNzd: pack.priceNzd }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        toast.error(data.error || 'Could not start checkout \u2014 please try again.')
        setPurchasing(false)
      }
    } catch (e) {
      toast.error('Could not start checkout \u2014 please try again.')
      setPurchasing(false)
    }
  }`;

const newContent = c.slice(0, idx) + replacement + c.slice(end);
fs.writeFileSync('components/membership/MembershipPanel.tsx', newContent, 'utf8');

console.log('Old direct-insert code removed:', !newContent.includes("from('credit_transactions')\n      .insert"));
console.log('New fetch call present:', newContent.includes("fetch('/api/checkout-credits'"));
