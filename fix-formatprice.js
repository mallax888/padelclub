const fs = require('fs');
const path = 'lib/currency.ts';
let c = fs.readFileSync(path, 'utf8');

const addition = `
const LOCALE_MAP: Record<CurrencyCode, string> = { nzd: 'en-NZ', aud: 'en-AU', zar: 'en-ZA' }

export function formatPrice(amount: number, currency: CurrencyCode = 'nzd'): string {
  return new Intl.NumberFormat(LOCALE_MAP[currency], {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount)
}
`;

c = c + addition;
fs.writeFileSync(path, c, 'utf8');
console.log('formatPrice added:', c.includes('export function formatPrice'));
