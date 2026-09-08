import { resend } from '@/lib/resend'
import type { Special } from '@/lib/specials'
import { renderEmailShell, EMAIL_BRAND } from '@/lib/email-template'

export async function sendBookingConfirmationEmail({
  to,
  name,
  court,
  date,
  time,
  duration,
  total,
  appUrl,
  specials = [],
  venueLabel = 'PadelClub',
}: {
  to: string
  name: string
  court: string
  date: string
  time: string
  duration: string
  total: string
  appUrl: string
  specials?: Special[]
  venueLabel?: string
}) {
  const specialsHtml = specials.length === 0 ? '' : `
          <div style="margin-top:16px;padding:14px 16px;background:${EMAIL_BRAND.bg};border:1px solid ${EMAIL_BRAND.primary};border-radius:8px">
            <div style="font-size:11px;font-weight:700;color:${EMAIL_BRAND.primary};letter-spacing:0.04em;text-transform:uppercase;margin-bottom:8px">While you're there</div>
            ${specials.map(s => `
            <div style="font-size:14px;color:${EMAIL_BRAND.text};font-weight:600">${s.title} at ${s.partnerName}</div>
            <div style="font-size:12px;color:${EMAIL_BRAND.textMuted};margin-top:2px">${s.blurb}${s.howToRedeem ? ' — ' + s.howToRedeem : ''}</div>
            `).join('')}
          </div>`
  await resend.emails.send({
    from: 'PadelClub <onboarding@resend.dev>',
    to,
    subject: `Booking confirmed — ${court}, ${date}`,
    html: renderEmailShell({
      heading: 'Booking Confirmed ✓',
      intro: `Hi ${name}, your court is booked!`,
      rows: [
        { label: 'Court', value: court },
        { label: 'Date', value: date },
        { label: 'Time', value: time },
        { label: 'Duration', value: duration },
        { label: 'Total', value: total },
      ],
      extraHtml: specialsHtml + `<p style="color:${EMAIL_BRAND.textMuted};font-size:13px;margin:16px 0 0">Need to cancel? Log in at least 24 hours before your booking.</p>`,
      ctaText: 'View my bookings',
      ctaUrl: `${appUrl}/mybookings`,
      footer: venueLabel,
    }),
  })
}
