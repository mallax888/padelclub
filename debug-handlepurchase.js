const fs = require('fs');
const c = fs.readFileSync('components/membership/MembershipPanel.tsx', 'utf8');
const idx = c.indexOf('const handlePurchase');
const end = c.indexOf('setPurchasing(false)\n  }', idx) + 'setPurchasing(false)\n  }'.length;
console.log(JSON.stringify(c.slice(idx, end)));
