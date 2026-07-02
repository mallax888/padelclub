export default function BookingLoading() {
  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-6" style={{ userSelect: 'none' }}>
        <div style={{ height: 28, width: 160, borderRadius: 8, background: 'var(--bg-raised)' }} className="animate-pulse mb-2" />
        <div style={{ height: 16, width: 240, borderRadius: 6, background: 'var(--bg-raised)' }} className="animate-pulse" />
      </div>
      <div className="flex gap-1.5 mb-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-1 flex-1 rounded-full" style={{ background: 'var(--bg-raised)' }} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', height: 180 }} />
        ))}
      </div>
    </div>
  )
}
