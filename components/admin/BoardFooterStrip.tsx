'use client'

export default function BoardFooterStrip({
  thisWeekCount,
  thisWeekTrend,
  peakTime,
  mostPopularCourtName,
  avgDurationLabel,
}: {
  thisWeekCount: number
  thisWeekTrend: number | null
  peakTime: string | null
  mostPopularCourtName: string | null
  avgDurationLabel: string | null
}) {
  const items = [
    { label: 'This week', value: `${thisWeekCount} bookings`, trend: thisWeekTrend },
    { label: 'Peak time', value: peakTime ?? '—', trend: null },
    { label: 'Most popular court', value: mostPopularCourtName ?? '—', trend: null },
    { label: 'Avg booking duration', value: avgDurationLabel ?? '—', trend: null },
  ]

  return (
    <div className="rounded-2xl mt-4 px-5 py-3 flex flex-wrap items-center gap-x-8 gap-y-2"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
      {items.map(item => (
        <div key={item.label} className="flex items-baseline gap-2">
          <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>{item.label}</span>
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{item.value}</span>
          {item.trend !== null && (
            <span className="text-[11px] font-bold" style={{ color: item.trend > 0 ? 'var(--brand-primary-text)' : item.trend < 0 ? 'var(--brand-crimson)' : 'var(--text-subtle)' }}>
              {item.trend > 0 ? '↑' : item.trend < 0 ? '↓' : '–'}{Math.abs(item.trend)}%
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
