import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import QRCode from 'qrcode'
import { getVenue } from '@/lib/venues'
import { clubLinkUrl, isLiveClub, shortLink } from '@/lib/club-link'
import PrintButton from '@/components/club/PrintButton'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Door poster | PadelMate' }

// A4 door poster for a club's booking link: club name, a big QR code, the address underneath.
// Only the public link goes on it, so anyone can open this page; the owner prints it from Club settings.
export default async function Poster({ params, searchParams }: { params: { slug: string }; searchParams?: { look?: string } }) {
  if (!isLiveClub(params.slug)) notFound()
  const venue = getVenue(params.slug)!
  const host = headers().get('host')
  const origin = process.env.NEXT_PUBLIC_APP_URL || (host ? `https://${host}` : '')
  const svg = await QRCode.toString(clubLinkUrl(origin, venue.slug), { type: 'svg', margin: 0, errorCorrectionLevel: 'M' })
  const lime = searchParams?.look === 'lime'
  const bg = lime ? '#d4f53c' : '#262B31', ink = lime ? '#17240a' : '#F7F8FA', soft = lime ? '#3b4d1f' : '#BBC3CC', accent = lime ? '#2F70CC' : '#d4f53c'
  return (
    <main style={{ background: '#1c2025', minHeight: '100vh', padding: 16 }} className="poster-wrap">
      <style>{`@page{size:A4;margin:0}@media print{.poster-wrap{background:#fff!important;padding:0!important}.no-print{display:none!important}.poster{width:210mm!important;height:297mm!important;border-radius:0!important}}`}</style>
      <div className="no-print" style={{ textAlign: 'center', marginBottom: 14 }}><PrintButton /></div>
      <div className="poster" data-testid="poster" style={{ width: 'min(100%, 560px)', aspectRatio: '210 / 297', margin: '0 auto', background: bg, color: ink, borderRadius: 12, padding: '8% 8%', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ fontSize: 'clamp(11px,2.6vw,15px)', fontWeight: 900, letterSpacing: '0.14em', textTransform: 'uppercase', color: lime ? ink : '#86BBF7' }}>{venue.name}</div>
        <h1 style={{ border: 0, padding: 0, color: "inherit", fontSize: 'clamp(30px,8vw,46px)', lineHeight: 1.02, fontWeight: 900, marginTop: 10 }}>Scan to<br /><span style={{ color: accent }}>book a court</span></h1>
        <div style={{ width: '56%', aspectRatio: '1', background: '#fff', borderRadius: 26, padding: '4%', margin: '5% 0 3%' }} dangerouslySetInnerHTML={{ __html: svg.replace('<svg ', '<svg style="width:100%;height:100%;display:block" ') }} />
        <p style={{ fontSize: 'clamp(13px,3.2vw,18px)', color: soft }}>Pick a time, pay, play.</p>
        <div data-testid="poster-link" style={{ fontSize: 'clamp(14px,3.8vw,22px)', fontWeight: 800, marginTop: 8 }}>{shortLink(origin, venue.slug)}</div>
        <div style={{ marginTop: 'auto', fontSize: 'clamp(9px,2.2vw,13px)', letterSpacing: '0.08em', color: soft }}>POWERED BY PADELMATE</div>
      </div>
    </main>
  )
}
