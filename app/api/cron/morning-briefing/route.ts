import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { sendPushToUser } from '@/lib/push'
import { getAppUrl } from '@/lib/env'
import { VENUES } from '@/lib/venues'
import { venueClock } from '@/lib/today'
import { DEFAULT_BRIEFING, briefingEmail, briefingPush, shouldSend } from '@/lib/briefing'
import { briefingRecipients, loadBriefing, loadBriefingSettings, sendBriefingEmail } from '@/lib/briefing-server'

// The morning briefing for every club whose chosen hour has come. An hourly job calls this; each club gets
// at most one a day (briefing_log), and only inside a few hours after its chosen time.
//   ?venue=slug  run one club only      ?at=ISO-time  pretend it is that time (for checking by hand)
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: 'Server misconfigured: CRON_SECRET is not set' }, { status: 500 })
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const only = url.searchParams.get('venue')
  const at = Date.parse(url.searchParams.get('at') ?? '')
  const nowMs = Number.isFinite(at) ? at : Date.now()
  const admin = createAdminClient() as any

  const probe = await admin.from('briefing_log').select('venue_slug').limit(1)
  if (probe.error) return NextResponse.json({ ok: true, skipped: 'The 035 database change has not been run.' })

  const { data: courtRows } = await admin.from('courts').select('venue_slug').eq('is_active', true)
  const slugs = Array.from(new Set(((courtRows ?? []) as any[]).map(c => c.venue_slug as string))).filter(s => VENUES.some(v => v.slug === s) && (!only || s === only))
  const base = getAppUrl(request)
  const sent: { venue: string; owners: number }[] = []

  for (const slug of slugs) {
    try {
      const settings = (await loadBriefingSettings(admin, slug)) ?? DEFAULT_BRIEFING
      const clock = venueClock(slug, nowMs)
      const { data: already } = await admin.from('briefing_log').select('venue_slug').eq('venue_slug', slug).eq('date', clock.date).maybeSingle()
      if (!shouldSend(settings, clock.hour, !!already)) continue
      const owners = await briefingRecipients(admin, slug)
      if (owners.length === 0) continue
      // Claim the day first, so two overlapping runs cannot both send.
      const { data: claimed } = await admin.from('briefing_log').upsert({ venue_slug: slug, date: clock.date, owners: owners.length }, { onConflict: 'venue_slug,date', ignoreDuplicates: true }).select()
      if (!claimed || claimed.length === 0) continue
      const loaded = await loadBriefing(admin, slug, nowMs)
      if (!loaded) continue
      const q = encodeURIComponent(slug)
      const links = { todayUrl: `${base}/admin/today?venue=${q}`, fillUrl: `${base}/admin/today?venue=${q}&act=fill`, remindUrl: `${base}/admin/today?venue=${q}&act=remind`, settingsUrl: `${base}/admin/setup?venue=${q}` }
      for (const o of owners) {
        const opts = { name: o.name, currency: loaded.currency, weekday: loaded.weekday, ...links }
        for (const m of briefingPush(loaded.briefing, opts)) {
          if (settings.push) await sendPushToUser(admin, o.id, m)
          const { error } = await admin.from('notifications').insert({ user_id: o.id, type: 'briefing', message: `${m.title}. ${m.body}` })
          if (error) console.error('Could not write a briefing to the bell for', o.id, error)
        }
        if (settings.email && o.email) {
          const mail = briefingEmail(loaded.briefing, { ...opts, venueName: loaded.venueName })
          await sendBriefingEmail(o.email, mail.subject, mail.html)
        }
      }
      sent.push({ venue: slug, owners: owners.length })
    } catch (err) {
      console.error('Morning briefing failed for', slug, err)
    }
  }
  return NextResponse.json({ ok: true, sent })
}
