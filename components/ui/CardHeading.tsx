import type { ReactNode } from 'react'

// The heading at the top of a card or a section. Bigger and heavier than the text around it,
// with the blue bar the page titles have, so it stands out when you scan a page. `section`
// is the larger one, for a group of cards.
export default function CardHeading({ children, sub, size = 'card', as: Tag = 'h3', className = 'mb-4' }: {
  children: ReactNode
  sub?: ReactNode
  size?: 'card' | 'section'
  as?: 'h2' | 'h3'
  className?: string
}) {
  const big = size === 'section'
  return (
    <div className={className}>
      <Tag className="leading-tight" style={{
        fontSize: big ? 24 : 20, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--text-primary)',
        borderLeft: '4px solid var(--brand-primary)', paddingLeft: 12,
      }}>{children}</Tag>
      {sub && <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)', paddingLeft: 16 }}>{sub}</p>}
    </div>
  )
}
