'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import toast from 'react-hot-toast'
import { formatPrice, type CurrencyCode } from '@/lib/currency'
import { clubLinkUrl, posterPath, shortLink, type LinkSummary } from '@/lib/club-link'

const card = { background: 'var(--bg-surface)', border: '1px solid var(--border)' } as const

// The club's own booking link and QR code: paste it in an Instagram bio, print it for the door. Anyone who signs up
// through it becomes this club's player, and the three numbers show what it has really brought in.
export default function BookingLinkCard({ venueSlug, venueName, origin, summary, currency }: {
  venueSlug: string; venueName: string; origin: string; summary: LinkSummary | null; currency: CurrencyCode
}) {
  const url = clubLinkUrl(origin, venueSlug)
  const [svg, setSvg] = useState('')
  useEffect(() => {
    let live = true
    QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' }).then(s => { if (live) setSvg(s.replace('<svg ', '<svg style="width:100%;height:100%;display:block" ')) }).catch(() => {})
    return () => { live = false }
  }, [url])

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); toast.success('Link copied') } catch { toast.error('Could not copy. Select the link and copy it by hand.') }
  }
  const share = async () => {
    const nav = navigator as Navigator & { share?: (d: { title?: string; text?: string; url?: string }) => Promise<void> }
    if (nav.share) { try { await nav.share({ title: venueName, text: `Book a court at ${venueName}`, url }) } catch { /* cancelled */ } } else { void copy() }
  }
  const download = async () => {
    try {
      const data = await QRCode.toDataURL(url, { width: 1024, margin: 2, errorCorrectionLevel: 'M' })
      const a = document.createElement('a'); a.href = data; a.download = `${venueSlug}-booking-qr.png`; a.click()
    } catch { toast.error('Could not make the picture. Try again.') }
  }

  return (
    <div className="rounded-[20px] p-5" style={card} data-testid="booking-link-card">
      <div className="text-[11px] font-extrabold uppercase" style={{ letterSpacing: '0.12em', color: 'var(--text-subtle)' }}>Your booking link</div>
      <div className="flex gap-5 items-center mt-3">
        <div className="shrink-0 rounded-2xl bg-white p-2.5" style={{ width: 132, height: 132 }} data-testid="booking-qr" dangerouslySetInnerHTML={{ __html: svg }} aria-label={`QR code for ${venueName}`} role="img" />
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-bold mb-2" style={{ color: 'var(--text-muted)' }}>Share this anywhere</div>
          <div className="flex items-center gap-2 rounded-2xl px-4 py-2.5" style={{ background: 'var(--bg-base)', border: '1px solid var(--border)' }}>
            <span className="min-w-0 flex-1 break-all text-[13px] leading-snug font-bold" data-testid="booking-link-url" style={{ color: 'var(--text-primary)' }}>{shortLink(origin, venueSlug)}</span>
            <button type="button" onClick={copy} data-testid="booking-link-copy" className="shrink-0 rounded-full px-3 py-1.5 text-[12px] font-black" style={{ background: '#d4f53c', color: '#17240a' }}>Copy</button>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <button type="button" onClick={share} data-testid="booking-link-share" className="btn btn-primary btn-sm">Share link</button>
            <button type="button" onClick={download} data-testid="booking-qr-download" className="btn btn-secondary btn-sm">Download QR</button>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-4 text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
        <div className="rounded-xl p-3" style={{ background: 'var(--bg-base)', border: '1px solid var(--border)' }}><b className="block text-[13px]" style={{ color: 'var(--text-primary)' }}>Instagram and Facebook</b>Paste it in your bio. One tap, straight to your courts.</div>
        <div className="rounded-xl p-3" style={{ background: 'var(--bg-base)', border: '1px solid var(--border)' }}><b className="block text-[13px]" style={{ color: 'var(--text-primary)' }}>Door, reception, flyers</b>Print the poster. Scan, pick a time, done.</div>
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        <a href={posterPath(venueSlug, 'dark')} target="_blank" rel="noreferrer" data-testid="poster-dark" className="btn btn-secondary btn-sm">Door poster (dark)</a>
        <a href={posterPath(venueSlug, 'lime')} target="_blank" rel="noreferrer" data-testid="poster-lime" className="btn btn-secondary btn-sm">Door poster (lime)</a>
      </div>
      {summary && (
        <div className="grid grid-cols-3 gap-2 mt-4" data-testid="booking-link-stats">
          {([
            [String(summary.joined30), 'joined through your link in the last 30 days', true],
            [String(summary.games), summary.joinedTotal === 0 ? 'games played by them' : `games played by the ${summary.joinedTotal} who joined this way`, false],
            [formatPrice(summary.booked, currency), 'court value of those games', false],
          ] as [string, string, boolean][]).map(([n, l, hot]) => (
            <div key={l} className="rounded-xl p-3" style={{ background: 'var(--bg-base)', border: '1px solid var(--border)' }}>
              <b className="block text-[22px] leading-none" style={{ color: hot && n !== '0' ? '#d4f53c' : 'var(--text-primary)' }}>{n}</b>
              <span className="block text-[11.5px] mt-1.5 leading-snug" style={{ color: 'var(--text-muted)' }}>{l}</span>
            </div>
          ))}
        </div>
      )}
      {summary && summary.joinedTotal === 0 && <p className="text-[12px] mt-3" style={{ color: 'var(--text-subtle)' }} data-testid="booking-link-empty">Nobody has joined through it yet. These numbers fill in as players sign up from your link.</p>}
    </div>
  )
}
