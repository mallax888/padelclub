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
