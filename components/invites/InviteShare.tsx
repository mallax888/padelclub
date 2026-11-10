'use client'

import toast from 'react-hot-toast'

// WhatsApp's own brand green, not a theme colour -- the same one RemindButton in
// MyBookingsList uses for the same reason: it says "this opens WhatsApp" before
// anyone reads the label, and it has to read that way in light and dark alike.
const WHATSAPP_GREEN = '#25D366'

// Three ways to send a friend the link to a spot on this booking. Every one of
// them opens the booker's own app with the message already written and sends
// nothing: they choose who it goes to and press send themselves. Deliberately
// not the WhatsApp Business API or a server-sent email -- those need a Meta
// business account, an approved template, a verified email domain and the
// friend's number or address, and the booker has all of that already, in the
// apps they use for this every day.
//
// Handlers rather than href attributes: the link has to be built from
// window.location.origin, which doesn't exist while the page renders on the
// server. An href that differs between server and browser is a hydration
// warning; a click handler is not.
export default function InviteShare({ token, court, venueName, when, amount }: {
  token: string
  court: string
  venueName: string
  when: string
  amount: string
}) {
  const link = () => `${window.location.origin}/join/${token}`
  const message = () =>
    `Hey! I've booked ${court} at ${venueName} on ${when} and saved you a spot. Your share is ${amount}.\n\nJoin here: ${link()}`

  const whatsapp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(message())}`, '_blank', 'noopener,noreferrer')
  }

  const email = () => {
    const subject = `Padel on ${when} — I've saved you a spot`
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message())}`
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link())
      toast.success('Link copied')
    } catch {
      // Clipboard access is refused in some in-app browsers and on plain http.
      // A prompt still lets the booker select the link and copy it by hand.
      window.prompt('Copy this link', link())
    }
  }

  const base = 'inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-3.5 py-2.5 rounded-xl whitespace-nowrap'
  const neutral = { background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' } as const

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={whatsapp} className={base}
        style={{ background: `${WHATSAPP_GREEN}24`, border: `1px solid ${WHATSAPP_GREEN}80`, color: 'var(--text-primary)' }}>
        {/* The green stays on the icon and the tint. As label text it was about
            2:1 on a light ground at 12px -- fine on dark, nearly unreadable on
            light -- so the words use the normal text colour instead. */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden style={{ color: WHATSAPP_GREEN }}><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2zm5.2 14.1c-.2.6-1.2 1.2-1.7 1.2-.5.1-1 .1-1.6-.1-.4-.1-.9-.3-1.5-.6-2.6-1.1-4.3-3.8-4.4-4-.1-.2-1-1.4-1-2.6s.6-1.8.9-2.1c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5s.8 1.9.8 2 .1.3 0 .4l-.3.5-.4.4c-.1.1-.3.3-.1.6s.6 1.1 1.4 1.8c1 .9 1.8 1.1 2 1.2s.4.1.6-.1.7-.8.9-1.1.4-.2.6-.1 1.5.7 1.8.8.4.2.5.3 0 .7-.3 1.3z"/></svg>
        WhatsApp
      </button>
      <button type="button" onClick={email} className={base} style={neutral}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--brand-blue)' }} aria-hidden><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>
        Email
      </button>
      <button type="button" onClick={copy} className={base} style={neutral}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--brand-yellow)' }} aria-hidden><path d="M10 13a5 5 0 0 0 7.1 0l3-3a5 5 0 0 0-7.1-7.1l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.1 0l-3 3a5 5 0 0 0 7.1 7.1l1.7-1.7"/></svg>
        Copy link
      </button>
    </div>
  )
}
