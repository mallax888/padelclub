'use client'

import { type Venue } from '@/lib/venues'

const ICON_MAP: Record<string, string> = {
  'ti-parking': 'P',
  'ti-coffee': '☕',
  'ti-shirt': '👕',
  'ti-shopping-bag': '🛍️',
  'ti-bulb': '💡',
  'ti-tools': '🔧',
  'ti-baby-carriage': '🧸',
}

export default function VenueLayout({ venue }: { venue: Venue }) {
  const maxX = Math.max(...venue.courts.map(c => c.x)) + 1
  const maxY = Math.max(...venue.courts.map(c => c.y)) + 1

  const cellW = 140
  const cellH = 90
  const gap = 10
  const pad = 16

  const svgW = maxX * cellW + (maxX - 1) * gap + pad * 2
  const svgH = maxY * cellH + (maxY - 1) * gap + pad * 2

  return (
    <div className="rounded-xl p-4 mb-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {venue.name}
          </div>
          <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>
            {venue.address} · {venue.courts.length} court{venue.courts.length > 1 ? 's' : ''}
          </div>
        </div>
        {!venue.isLive && (
          <span
            className="text-[10px] font-medium px-2 py-1 rounded-full"
            style={{ background: 'var(--brand-accent-muted)', color: 'var(--brand-accent)' }}
          >
            Coming soon — preview
          </span>
        )}
      </div>

      <div className="flex justify-center mb-4 overflow-x-auto">
        <svg
          width={svgW}
          height={svgH}
          viewBox={`0 0 ${svgW} ${svgH}`}
          role="img"
          aria-label={`Court layout for ${venue.name}`}
          style={{ userSelect: 'none' }}
        >
          <title>Court layout for {venue.name}</title>
          {venue.courts.map(court => {
            const x = pad + court.x * (cellW + gap)
            const y = pad + court.y * (cellH + gap)
            const fill = court.isIndoor ? 'var(--brand-primary-muted)' : 'var(--bg-raised)'
            const stroke = court.isIndoor ? 'var(--brand-primary)' : 'var(--border)'
            const textColor = court.isIndoor ? 'var(--brand-primary)' : 'var(--text-muted)'
            return (
              <g key={court.id}>
                <rect
                  x={x} y={y} width={cellW} height={cellH} rx={8}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={1}
                />
                <line
                  x1={x + cellW / 2} y1={y + 10}
                  x2={x + cellW / 2} y2={y + cellH - 10}
                  stroke={stroke}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  opacity={0.4}
                />
                <text x={x + cellW / 2} y={y + 24} textAnchor="middle"
                  fontSize="13" fontWeight="500" fill={textColor}>

@'
'use client'

import { type Venue } from '@/lib/venues'

const ICON_MAP: Record<string, string> = {
  'ti-parking': 'P',
  'ti-coffee': '☕',
  'ti-shirt': '👕',
  'ti-shopping-bag': '🛍️',
  'ti-bulb': '💡',
  'ti-tools': '🔧',
  'ti-baby-carriage': '🧸',
}

export default function VenueLayout({ venue }: { venue: Venue }) {
  const maxX = Math.max(...venue.courts.map(c => c.x)) + 1
  const maxY = Math.max(...venue.courts.map(c => c.y)) + 1

  const cellW = 140
  const cellH = 90
  const gap = 10
  const pad = 16

  const svgW = maxX * cellW + (maxX - 1) * gap + pad * 2
  const svgH = maxY * cellH + (maxY - 1) * gap + pad * 2

  return (
    <div className="rounded-xl p-4 mb-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {venue.name}
          </div>
          <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>
            {venue.address} · {venue.courts.length} court{venue.courts.length > 1 ? 's' : ''}
          </div>
        </div>
        {!venue.isLive && (
          <span
            className="text-[10px] font-medium px-2 py-1 rounded-full"
            style={{ background: 'var(--brand-accent-muted)', color: 'var(--brand-accent)' }}
          >
            Coming soon — preview
          </span>
        )}
      </div>

      <div className="flex justify-center mb-4 overflow-x-auto">
        <svg
          width={svgW}
          height={svgH}
          viewBox={`0 0 ${svgW} ${svgH}`}
          role="img"
          aria-label={`Court layout for ${venue.name}`}
          style={{ userSelect: 'none' }}
        >
          <title>Court layout for {venue.name}</title>
          {venue.courts.map(court => {
            const x = pad + court.x * (cellW + gap)
            const y = pad + court.y * (cellH + gap)
            const fill = court.isIndoor ? 'var(--brand-primary-muted)' : 'var(--bg-raised)'
            const stroke = court.isIndoor ? 'var(--brand-primary)' : 'var(--border)'
            const textColor = court.isIndoor ? 'var(--brand-primary)' : 'var(--text-muted)'
            return (
              <g key={court.id}>
                <rect
                  x={x} y={y} width={cellW} height={cellH} rx={8}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={1}
                />
                <line
                  x1={x + cellW / 2} y1={y + 10}
                  x2={x + cellW / 2} y2={y + cellH - 10}
                  stroke={stroke}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  opacity={0.4}
                />
                <text x={x + cellW / 2} y={y + 24} textAnchor="middle"
                  fontSize="13" fontWeight="500" fill={textColor}>
                  {court.name}
                </text>
                <text x={x + cellW / 2} y={y + 44} textAnchor="middle"
                  fontSize="11" fill="var(--text-subtle)">
                  {court.type}
                </text>
                <text x={x + cellW / 2} y={y + 64} textAnchor="middle"
                  fontSize="11" fill="var(--text-subtle)">
                  {court.isIndoor ? 'Indoor' : 'Outdoor'}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      <div className="flex flex-wrap gap-2">
        {venue.amenities.map(a => (
          <div
            key={a.label}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
            style={{ background: 'var(--bg-raised)', color: 'var(--text-muted)' }}
          >
            <span>{ICON_MAP[a.icon] ?? '•'}</span>
            <span>{a.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
