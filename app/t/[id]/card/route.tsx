import { ImageResponse } from 'next/og'
import { createAdminClient } from '@/lib/supabase-admin'
import { loadShared } from '@/lib/share-server'

export const dynamic = 'force-dynamic'

// The picture players post: the club, the tournament and the top of the leaderboard.
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const s = await loadShared(createAdminClient() as any, params.id)
  if (!s) return new Response('Not found', { status: 404 })
  const rows = s.summary.rows
  const download = new URL(request.url).searchParams.get('download') === '1'
  const img = new ImageResponse(
    (
      <div style={{ width: 1080, height: 1080, display: 'flex', flexDirection: 'column', padding: 80, color: '#fff', background: 'linear-gradient(160deg,#2c5fc4,#1d3f8d)', position: 'relative' }}>
        <div style={{ position: 'absolute', right: -140, top: -140, width: 520, height: 520, borderRadius: 520, background: 'rgba(212,245,60,0.18)', display: 'flex' }} />
        <div style={{ display: 'flex', fontSize: 30, letterSpacing: 4, fontWeight: 700, opacity: 0.85 }}>{s.club.toUpperCase()}</div>
        <div style={{ display: 'flex', fontSize: 84, fontWeight: 800, marginTop: 18, lineHeight: 1.05 }}>{s.name}</div>
        <div style={{ display: 'flex', fontSize: 32, opacity: 0.85, marginTop: 14 }}>{s.date} · {s.summary.detail}</div>
        <div style={{ display: 'flex', fontSize: 28, letterSpacing: 3, fontWeight: 700, marginTop: 56, opacity: 0.85 }}>{s.summary.heading.toUpperCase()}</div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 22 }}>
          {rows.length === 0 && <div style={{ display: 'flex', fontSize: 40, opacity: 0.85 }}>No scores yet</div>}
          {rows.map(r => (
            <div key={r.rank} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: 28, padding: '26px 36px', marginBottom: 18, fontSize: r.rank === 1 ? 56 : 46, fontWeight: r.rank === 1 ? 800 : 700, background: r.rank === 1 ? '#d4f53c' : 'rgba(255,255,255,0.16)', color: r.rank === 1 ? '#17240a' : '#fff' }}>
              <div style={{ display: 'flex' }}>{r.rank}  {r.name}</div>
              <div style={{ display: 'flex' }}>{r.score !== null ? r.score : ''}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', position: 'absolute', left: 80, right: 80, bottom: 60, fontSize: 28, fontWeight: 700, opacity: 0.85 }}>
          <div style={{ display: 'flex' }}>PADELMATE</div>
        </div>
      </div>
    ),
    { width: 1080, height: 1080 },
  )
  if (download) img.headers.set('Content-Disposition', `attachment; filename="${s.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png"`)
  return img
}
