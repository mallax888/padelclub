import { NextResponse } from 'next/server'
import { sendBookingConfirmationEmail } from '@/lib/emails'

export async function POST(request: Request) {
  try {
    const { to, name, court, date, time, duration, total } = await request.json()
    await sendBookingConfirmationEmail({ to, name, court, date, time, duration, total })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
