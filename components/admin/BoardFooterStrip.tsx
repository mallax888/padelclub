'use client'

const ICONS: Record<string, JSX.Element> = {
  trend: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 15l4-6 4 3 5-8"/></svg>,
  clock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>,
  court: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="3.2"/></svg>,
  duration: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/></svg>,
}

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
    { label: 'This week', value: `${thisWeekCount} bookings`, trend: thisWeekTrend, icon: 'trend' },
    { label: 'Peak time', value: peakTime ?? '—', trend: null, icon: 'clock' },
    { label: 'Most popular court', value: mostPopularCourtName ?? '—', trend: null, icon: 'court' },
    { label: 'Avg booking duration', value: avgDurationLabel ?? '—', trend: null, icon: 'duration' },
  ]

  return (
    <div className="rounded-2xl mt-4 px-5 py-3 flex flex-wrap items-center gap-x-8 gap-y-3"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
      {items.map(item => (
        <div key={item.label} className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: '#E8352F1F', color: '#E8352F' }}>
            <span style={{ width: 14, height: 14 }}>{ICONS[item.icon]}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>{item.label}</span>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{item.value}</span>
            {item.trend !== null && (
              <span className="text-[11px] font-bold" style={{ color: item.trend > 0 ? 'var(--brand-primary-text)' : item.trend < 0 ? 'var(--brand-crimson)' : 'var(--text-subtle)' }}>
                {item.trend > 0 ? '↑' : item.trend < 0 ? '↓' : '–'}{Math.abs(item.trend)}%
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
