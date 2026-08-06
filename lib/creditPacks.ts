// Canonical credit-pack prices. The server (checkout-credits route) looks
// packId up here and ignores any price the client sends -- this list is the
// only thing that decides what a pack actually costs.
export const CREDIT_PACKS = [
  { id: 'pack5', sessions: 5, priceNzd: 150, save: null as string | null },
  { id: 'pack10', sessions: 10, priceNzd: 270, save: 'Save $30' },
  { id: 'pack20', sessions: 20, priceNzd: 500, save: 'Save $100' },
]
