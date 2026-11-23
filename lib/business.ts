// Who is behind PadelMate, for the Terms, Privacy, Refunds and Contact pages and the footer links. Fill in the empty ones when you have
// them (company number, address, support email, phone, GST number) and they appear on the pages; nothing is made up in the meantime.
export const BUSINESS = {
  tradingName: 'PadelMate',
  legalName: 'Forge Ripple Limited',
  companyNumber: null as string | null,
  address: null as string | null,
  supportEmail: null as string | null,
  phone: null as string | null,
  gstNumber: null as string | null,
  lastUpdated: '19 November 2026',
}

export const LEGAL_LINKS = [
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/refunds', label: 'Refunds and cancellations' },
  { href: '/club-terms', label: 'Terms for clubs' },
  { href: '/contact', label: 'Contact' },
] as const
