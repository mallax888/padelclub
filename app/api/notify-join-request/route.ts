import { Resend } from 'resend'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  try {
    const { organizerEmail, organizerName, playerName, court, date, time, matchUrl, organizerId } = await request.json()

    await resend.emails.send({
      from: 'PadelClub <onboarding@resend.dev>',
      to: organizerEmail,
      subject: `${playerName} wants to join your match — ${court}, ${date}`,
      html: `
        <div style="font-family:system-ui;max-width:500px;margin:0 auto;padding:24px">
          <div style="background:#18181B;padding:20px 24px;border-radius:10px 10px 0 0;border-bottom:2px solid #4DFFEE">
            <h1 style="color:#4DFFEE;margin:0;font-size:20px">🎾 Join request!</h1>
          </div>
          <div style="background:#1a1a1a;padding:24px;border-radius:0 0 10px 10px;border:1px solid #333">
            <p style="color:#F4F4F5;margin:0 0 16px">Hi ${organizerName}, <strong style="color:#4DFFEE">${playerName}</strong> wants to join your match.</p>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:8px 0;color:#A1A1AA;font-size:14px;border-bottom:1px solid #333">Court</td><td style="padding:8px 0;font-weight:500;font-size:14px;border-bottom:1px solid #333;text-align:right;color:#F4F4F5">${court}</td></tr>
              <tr><td style="padding:8px 0;color:#A1A1AA;font-size:14px;border-bottom:1px solid #333">Date</td><td style="padding:8px 0;font-weight:500;font-size:14px;border-bottom:1px solid #333;text-align:right;color:#F4F4F5">${date}</td></tr>
              <tr><td style="padding:8px 0;color:#A1A1AA;font-size:14px">Time</td><td style="padding:8px 0;font-weight:500;font-size:14px;text-align:right;color:#F4F4F5">${time}</td></tr>
            </table>
            <p style="color:#A1A1AA;font-size:13px;margin:16px 0">Log in to accept or decline this request.</p>
            <div style="margin-top:20px;text-align:center">
              <a href="${matchUrl}" style="background:#4DFFEE;color:#001F1D;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">View match</a>
            </div>
          </div>
          <p style="color:#555;font-size:12px;text-align:center;margin-top:16px">PadelClub · New Zealand</p>
        </div>
      `,
    })

    if (organizerId) {
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      await sb.from('notifications').insert({
        user_id: organizerId,
        type: 'join_request',
        message: playerName + ' wants to join your match on ' + court + ' — ' + date + ' at ' + time,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 })
  }
}
