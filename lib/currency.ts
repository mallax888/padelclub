export type CurrencyCode = 'nzd' | 'aud' | 'zar'

const NZ_REGIONS = ['Auckland', 'Wellington', 'Christchurch']
const AU_REGIONS = ['Sydney', 'Melbourne', 'Brisbane', 'Perth']
const ZA_REGIONS = ['Nelspruit', 'Johannesburg', 'Cape Town', 'Durban', 'Pretoria']

export function currencyForRegion(region: string | undefined | null): CurrencyCode {
  if (!region) return 'nzd'
  if (AU_REGIONS.includes(region)) return 'aud'
  if (ZA_REGIONS.includes(region)) return 'zar'
  return 'nzd'
}

export function currencySymbol(currency: CurrencyCode): string {
  if (currency === 'aud') return 'A$'
  if (currency === 'zar') return 'R'
  return 'NZ$'
}

const LOCALE_MAP: Record<CurrencyCode, string> = { nzd: 'en-NZ', aud: 'en-AU', zar: 'en-ZA' }

export function formatPrice(amount: number, currency: CurrencyCode = 'nzd'): string {
  const formatted = new Intl.NumberFormat(LOCALE_MAP[currency], {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount)
  // en-ZA renders ZAR with a comma as the decimal separator ("R 37,00")
  // instead of a period — every other currency here already uses a period,
  // so normalize just that one. NZD/AUD's thousands-separator comma (e.g.
  // "$1,234.50") is untouched.
  return currency === 'zar' ? formatted.replace(',', '.') : formatted
}
