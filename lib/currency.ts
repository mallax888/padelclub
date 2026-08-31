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

// Sums a set of amounts that may span more than one venue's currency (an
// unscoped admin sees every country's bookings at once) into one bucket per
// currency, instead of blindly adding NZD+AUD+ZAR numbers together as if
// they were the same unit. `getCurrency` maps whatever the caller has to
// hand (usually a venue_slug) to a CurrencyCode.
export function sumByCurrency<T>(
  rows: T[],
  getCurrency: (row: T) => CurrencyCode,
  getAmount: (row: T) => number,
): { currency: CurrencyCode; amount: number }[] {
  const totals = new Map<CurrencyCode, number>()
  for (const row of rows) {
    const currency = getCurrency(row)
    totals.set(currency, (totals.get(currency) ?? 0) + getAmount(row))
  }
  // Stable, currency-agnostic order so the display doesn't jump around
  // between renders.
  const order: CurrencyCode[] = ['nzd', 'aud', 'zar']
  return order
    .filter(c => totals.has(c))
    .map(currency => ({ currency, amount: totals.get(currency)! }))
}

// Renders a sumByCurrency() result as display text -- a single formatted
// amount when everything's in one currency (the common case: a scoped
// venue/country manager), or each currency's total joined together when
// the data spans more than one (an unscoped admin viewing every country).
export function formatMultiCurrency(totals: { currency: CurrencyCode; amount: number }[]): string {
  if (totals.length === 0) return formatPrice(0, 'nzd')
  return totals.map(t => formatPrice(t.amount, t.currency)).join(' + ')
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
