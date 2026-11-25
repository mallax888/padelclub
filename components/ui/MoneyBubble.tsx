import type { ReactNode } from 'react'
import { MONEY_HEX, type MoneyKind } from '@/lib/money-colours'

// The bubble of the money colour rule, white text. On the dark theme it is the soft style (a tinted bubble with a coloured outline);
// on the light theme the same colour goes solid, because white text needs a strong colour behind it to be read.
// Counts are blue, money made is green, money lost or overdue is red, and a figure set by hand is grey.
const SOFT: Record<MoneyKind, string> = { gain: 'rgba(31,154,95,0.30)', loss: 'rgba(196,52,58,0.34)', wait: 'rgba(47,111,214,0.34)', none: 'rgba(255,255,255,0.12)' }

export default function MoneyBubble({ kind, children, size = 12, testId, className = '', strike = false, wrap = false }: { kind: MoneyKind; children: ReactNode; size?: number; testId?: string; className?: string; strike?: boolean; wrap?: boolean }) {
  return (
    <span data-testid={testId} data-money={kind} className={`money-bubble inline-block ${wrap ? 'rounded-2xl whitespace-normal' : 'rounded-full whitespace-nowrap'} font-extrabold tabular-nums ${className}`}
      style={{ ['--mb-hex' as any]: MONEY_HEX[kind], ['--mb-soft' as any]: SOFT[kind], fontSize: size, padding: size >= 14 ? '3px 12px' : '2px 9px', textDecoration: strike ? 'line-through' : undefined }}>{children}</span>
  )
}
