// Shown the moment a page is tapped, while the server builds the real one: the same frame, grey shapes where the content goes.
// (The Book page has its own.) Nothing here fetches anything.
export default function Loading() {
  const bar = { background: 'var(--bg-raised)', borderRadius: 12 } as const
  return (
    <div className="w-full flex flex-col gap-5 mt-4" aria-busy="true" aria-label="Loading">
      <div style={{ ...bar, height: 32, width: '55%' }} className="animate-pulse" />
      <div style={{ ...bar, height: 14, width: '32%' }} className="animate-pulse" />
      <div style={{ ...bar, height: 150, borderRadius: 22 }} className="animate-pulse" />
      <div className="grid grid-cols-2 gap-4">
        <div style={{ ...bar, height: 110, borderRadius: 20 }} className="animate-pulse" />
        <div style={{ ...bar, height: 110, borderRadius: 20 }} className="animate-pulse" />
      </div>
      <div style={{ ...bar, height: 90, borderRadius: 20 }} className="animate-pulse" />
    </div>
  )
}
