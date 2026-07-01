const fs = require('fs');
let c = fs.readFileSync('components/admin/AdminDashboard.tsx', 'utf8');
c = c.replace(
  "      ) : viewMode === 'month' ? (\n        ) : viewMode === 'month' ? (",
  "      ) : viewMode === 'month' ? ("
);
fs.writeFileSync('components/admin/AdminDashboard.tsx', c, 'utf8');
console.log('Fixed:', !c.includes("month' ? (\n        ) : viewMode === 'month'"));
