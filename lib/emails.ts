import { resend } from '@/lib/resend'
import type { Special } from '@/lib/specials'

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
}) {
  const specialsHtml = specials.length === 0 ? '' : `
          <div style="margin-top:16px;padding:14px 16px;background:#fdf2f8;border:1px solid #f9a8d4;border-radius:8px">
            <div style="font-size:11px;font-weight:700;color:#C4005A;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:8px">While you're there</div>
            ${specials.map(s => `
            <div style="font-size:14px;color:#333;font-weight:600">${s.title} at ${s.partnerName}</div>
            <div style="font-size:12px;color:#888;margin-top:2px">${s.blurb}${s.howToRedeem ? ' — ' + s.howToRedeem : ''}</div>
            `).join('')}
          </div>`
  await resend.emails.send({
    from: 'PadelClub <onboarding@resend.dev>',
    to,
    subject: `Booking confirmed — ${court}, ${date}`,
    html: `
      <div style="font-family:system-ui;max-width:500px;margin:0 auto;padding:24px">
        <div style="background:#1D9E75;padding:20px 24px;border-radius:10px 10px 0 0">
          <h1 style="color:#fff;margin:0;font-size:20px">Booking Confirmed ✓</h1>
        </div>
        <div style="background:#f9f9f9;padding:24px;border-radius:0 0 10px 10px;border:1px solid #eee">
          <p style="color:#333;margin:0 0 16px">Hi ${name}, your court is booked!</p>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px 0;color:#888;font-size:14px;border-bottom:1px solid #eee">Court</td><td style="padding:8px 0;font-weight:500;font-size:14px;border-bottom:1px solid #eee;text-align:right">${court}</td></tr>
            <tr><td style="padding:8px 0;color:#888;font-size:14px;border-bottom:1px solid #eee">Date</td><td style="padding:8px 0;font-weight:500;font-size:14px;border-bottom:1px solid #eee;text-align:right">${date}</td></tr>
            <tr><td style="padding:8px 0;color:#888;font-size:14px;border-bottom:1px solid #eee">Time</td><td style="padding:8px 0;font-weight:500;font-size:14px;border-bottom:1px solid #eee;text-align:right">${time}</td></tr>
            <tr><td style="padding:8px 0;color:#888;font-size:14px;border-bottom:1px solid #eee">Duration</td><td style="padding:8px 0;font-weight:500;font-size:14px;border-bottom:1px solid #eee;text-align:right">${duration}</td></tr>
            <tr><td style="padding:8px 0;color:#888;font-size:14px">Total</td><td style="padding:8px 0;font-weight:500;font-size:14px;text-align:right">${total}</td></tr>
          </table>
          ${specialsHtml}
          <p style="color:#888;font-size:13px;margin:16px 0 0">Need to cancel? Log in at least 24 hours before your booking.</p>
          <div style="margin-top:20px;text-align:center">
            <a href="${appUrl}/mybookings" style="background:#1D9E75;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:14px">View my bookings</a>
          </div>
        </div>
        <p style="color:#bbb;font-size:12px;text-align:center;margin-top:16px">PadelClub · Auckland, New Zealand</p>
      </div>
    `,
  })
}
