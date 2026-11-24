// Server-only: finds who a club's announcement goes to, tells them, and reads the notices back.
import { getVenue } from '@/lib/venues'
import { sendPushToUser } from '@/lib/push'
import { sendClubEmail } from '@/lib/club-server'
import { tableMissing } from '@/lib/club-server'
import { homeClubIds, pastPlayerIds } from '@/lib/offers'
import { MAX_EMAILS, MAX_TOLD, bellMessage, noticeExpiry, type AnnouncementInput } from '@/lib/announcements'

type Admin = any
export type Notice = { id: string; venue_slug: string; title: string; body: string; created_at: string; expires_at: string }
export type Sent = { ok: true; id: string; told: number; emailed: number } | { ok: false; status: number; error: string }

// Everyone who plays at the club: whose home club it is, and anyone who has booked a court there lately.
export async function announcementAudience(admin: Admin, venueSlug: string, nowMs: number = Date.now()): Promise<string[]> {
  const { data: courts } = await admin.from('courts').select('id').eq('venue_slug', venueSlug)
  const ids = new Set<string>(await homeClubIds(admin, venueSlug))
  for (const id of await pastPlayerIds(admin, ((courts ?? []) as any[]).map(c => c.id), nowMs)) ids.add(id)
  return Array.from(ids)
}

// `audienceOverride` sends to exactly those people (a group the owner picked) instead of everyone at the club.
export async function sendAnnouncement(admin: Admin, input: AnnouncementInput & { venueSlug: string; createdBy: string }, nowMs: number = Date.now(), audienceOverride?: string[]): Promise<Sent> {
  const { data: row, error } = await admin.from('club_announcements').insert({
    venue_slug: input.venueSlug, title: input.title, body: input.body, by_push: input.push, by_email: input.email, show_on_home: input.home,
    told_count: 0, created_by: input.createdBy, created_at: new Date(nowMs).toISOString(), expires_at: noticeExpiry(nowMs),
  }).select('id').single()
  if (tableMissing(error)) return { ok: false, status: 503, error: "Announcements aren't switched on yet. Run the 038 database change first." }
  if (error || !row) return { ok: false, status: 500, error: 'Could not send that. Please try again.' }

  const audience = (audienceOverride ?? await announcementAudience(admin, input.venueSlug, nowMs)).filter(id => id !== input.createdBy).slice(0, MAX_TOLD)
  const venue = getVenue(input.venueSlug)
  const message = bellMessage(input.title, input.body)
  if (input.push || input.home) {
    // The bell always gets it: it is where the message waits for anyone who did not see the phone notification.
    for (let i = 0; i < audience.length; i += 100) {
      await admin.from('notifications').insert(audience.slice(i, i + 100).map(user_id => ({ user_id, type: 'club_announcement', message: `${venue.name}: ${message}` })))
    }
  }
  if (input.push) {
    for (let i = 0; i < audience.length; i += 20) {
      await Promise.all(audience.slice(i, i + 20).map(id => sendPushToUser(admin, id, { title: venue.name, body: message, url: '/home' }).catch(() => null)))
    }
  }
  let emailed = 0
  if (input.email) {
    const { data: people } = await admin.from('profiles').select('email').in('id', audience.slice(0, MAX_EMAILS))
    const addresses = ((people ?? []) as any[]).map(p => p.email as string | null).filter((e): e is string => !!e)
    for (let i = 0; i < addresses.length; i += 10) {
      const results = await Promise.all(addresses.slice(i, i + 10).map(to => sendClubEmail({ to, subject: `${venue.name}: ${input.title}`, heading: input.title, intro: escapeHtml(input.body || input.title), footer: `Sent by ${venue.name} through PadelMate.` })))
      emailed += results.filter(Boolean).length
    }
  }
  await admin.from('club_announcements').update({ told_count: audience.length }).eq('id', row.id)
  return { ok: true, id: row.id, told: audience.length, emailed }
}

const escapeHtml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')

// The notices still showing on Home for a club (newest first). Empty when the 038 change has not been run.
export async function loadNotices(admin: Admin, venueSlug: string | null | undefined, nowMs: number = Date.now(), limit = 2): Promise<Notice[]> {
  if (!venueSlug) return []
  const { data, error } = await admin.from('club_announcements').select('id, venue_slug, title, body, created_at, expires_at')
    .eq('venue_slug', venueSlug).eq('show_on_home', true).gt('expires_at', new Date(nowMs).toISOString()).order('created_at', { ascending: false }).limit(limit)
  return error ? [] : ((data ?? []) as Notice[])
}

// The owner's own list of what was sent lately, and whether announcements are switched on at all.
export async function loadRecent(admin: Admin, venueSlug: string, limit = 5): Promise<{ available: boolean; rows: (Notice & { told_count: number })[] }> {
  const { data, error } = await admin.from('club_announcements').select('id, venue_slug, title, body, created_at, expires_at, told_count').eq('venue_slug', venueSlug).order('created_at', { ascending: false }).limit(limit)
  return error ? { available: false, rows: [] } : { available: true, rows: (data ?? []) as any[] }
}
