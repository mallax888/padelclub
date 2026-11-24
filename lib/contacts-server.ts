// Server-only: a club's imported contacts. Importing them, linking them to accounts, and the one invite and one reminder.
// Only call after checking the caller is an owner whose reach covers the club.
import { resend, emailFrom } from '@/lib/resend'
import { renderEmailShell } from '@/lib/email-template'
import { escapeHtml } from '@/lib/club-server'
import { clubLinkUrl } from '@/lib/club-link'
import { unsubApiUrl, unsubUrl } from '@/lib/unsubscribe'
import { FOOTER_TEXT, emailCopy, needsInvite, reminderDue, type Contact } from '@/lib/contact-rules'
import { classify, type ContactRow, type Known, type MappedRow } from '@/lib/contact-import'

type Admin = any
export const BATCH = 100 // Resend takes up to 100 emails in one call
const chunks = <T,>(a: T[], n: number): T[][] => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n))

export async function contactsAvailable(admin: Admin): Promise<boolean> {
  const { error } = await admin.from('club_contacts').select('id').limit(1)
  return !error
}

const toContact = (r: any): Contact => ({
  id: r.id, name: r.name, email: r.email, phone: r.phone ?? null, lastPlayed: r.last_played ?? null, userId: r.user_id ?? null,
  status: r.status, invitedAt: r.invited_at ?? null, remindedAt: r.reminded_at ?? null, unsubscribedAt: r.unsubscribed_at ?? null,
})

export async function loadContacts(admin: Admin, slug: string): Promise<Contact[]> {
  const { data, error } = await admin.from('club_contacts').select('id, name, email, phone, last_played, user_id, status, invited_at, reminded_at, unsubscribed_at').eq('venue_slug', slug).limit(10000)
  if (error) return []
  return ((data ?? []) as any[]).map(toContact)
}

// Which of these emails already have a PadelMate account (email -> user id), and which are already this club's contacts.
export async function knownFor(admin: Admin, slug: string, emails: string[]): Promise<Known> {
  const profiles = new Map<string, string>(), contacts = new Set<string>()
  for (const part of chunks(Array.from(new Set(emails)), 150)) {
    const [{ data: p }, { data: c }] = await Promise.all([
      admin.from('profiles').select('id, email').in('email', part),
      admin.from('club_contacts').select('email').eq('venue_slug', slug).in('email', part),
    ])
    for (const r of ((p ?? []) as any[])) if (r.email) profiles.set(String(r.email).toLowerCase(), r.id)
    for (const r of ((c ?? []) as any[])) contacts.add(String(r.email).toLowerCase())
  }
  return { profiles, contacts }
}

export type ImportResult = { added: number; linked: number; alreadyImported: number; duplicates: number; invalid: number }
export async function importContacts(admin: Admin, slug: string, rows: ContactRow[], importedBy: string): Promise<ImportResult> {
  const mapped: MappedRow[] = rows.map((r, i) => ({ ...r, line: i + 2 }))
  const known = await knownFor(admin, slug, mapped.map(r => r.email))
  const c = classify(mapped, known)
  const toRow = (r: MappedRow, extra: Record<string, unknown>) => ({ venue_slug: slug, name: r.name, email: r.email, phone: r.phone, last_played: r.lastPlayed, imported_by: importedBy, ...extra })
  const inserts = [...c.ready.map(r => toRow(r, { status: 'imported' })), ...c.onPadelmate.map(r => toRow(r, { status: 'joined', user_id: r.userId }))]
  for (const part of chunks(inserts, 500)) {
    const { error } = await admin.from('club_contacts').insert(part)
    if (error) throw new Error('Could not save the players: ' + error.message)
  }
  return { added: c.ready.length, linked: c.onPadelmate.length, alreadyImported: c.alreadyImported.length, duplicates: c.duplicates, invalid: c.invalid.length }
}

// Someone with this email just made an account: attach them to every club that had them as a contact.
export async function linkContactsByEmail(admin: Admin, userId: string, email: string): Promise<number> {
  const e = email.trim().toLowerCase(); if (!e) return 0
  const { data, error } = await admin.from('club_contacts').update({ user_id: userId, status: 'joined' }).eq('email', e).is('user_id', null).select('id')
  return error ? 0 : ((data ?? []) as any[]).length
}

export type Sent = { sent: number; failed: number; joined: number; remaining: number }
export type SendFn = (messages: { to: string; subject: string; html: string; headers: Record<string, string> }[]) => Promise<boolean>

export const sendViaResend: SendFn = async (messages) => {
  if (!process.env.RESEND_API_KEY) return false
  try {
    const { error } = await resend.batch.send(messages.map(m => ({ from: emailFrom(), to: m.to, subject: m.subject, html: m.html, headers: m.headers })))
    if (error) { console.error('Could not send a batch of club invites', error); return false }
    return true
  } catch (e) { console.error('Could not send a batch of club invites', e); return false }
}

// Sends one batch (up to 100) of invites, or of the single reminder. The browser calls this again until nothing remains.
export async function sendBatch(admin: Admin, o: { slug: string; venueName: string; mode: 'invite' | 'remind'; intro: string; origin: string; nowMs?: number; send?: SendFn }): Promise<Sent> {
  const now = o.nowMs ?? Date.now(), send = o.send ?? sendViaResend
  const eligible = (await loadContacts(admin, o.slug)).filter(c => (o.mode === 'invite' ? needsInvite(c) : reminderDue(c, now)))
  const batch = eligible.slice(0, BATCH), remaining = eligible.length - batch.length
  if (batch.length === 0) return { sent: 0, failed: 0, joined: 0, remaining: 0 }

  // Anyone who made an account since the import is linked, not emailed.
  const known = await knownFor(admin, o.slug, batch.map(c => c.email))
  const joined = batch.filter(c => known.profiles.has(c.email))
  for (const c of joined) await admin.from('club_contacts').update({ user_id: known.profiles.get(c.email), status: 'joined' }).eq('id', c.id)
  const toSend = batch.filter(c => !known.profiles.has(c.email))
  if (toSend.length === 0) return { sent: 0, failed: 0, joined: joined.length, remaining }

  const copy = emailCopy(o.mode, o.venueName, o.intro)
  const link = clubLinkUrl(o.origin, o.slug)
  const messages = toSend.map(c => {
    const un = unsubUrl(o.origin, c.id)
    const html = renderEmailShell({
      heading: escapeHtml(copy.heading), intro: escapeHtml(copy.intro), ctaText: escapeHtml(copy.cta), ctaUrl: link,
      footer: `${escapeHtml(FOOTER_TEXT(o.venueName))} <a href="${un}" style="color:inherit">Unsubscribe</a>`,
    })
    return { to: c.email, subject: copy.subject, html, headers: { 'List-Unsubscribe': `<${unsubApiUrl(o.origin, c.id)}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } }
  })
  const okSent = await send(messages)
  if (!okSent) return { sent: 0, failed: toSend.length, joined: joined.length, remaining }
  const at = new Date(now).toISOString()
  const patch = o.mode === 'invite' ? { status: 'invited', invited_at: at } : { reminded_at: at }
  for (const part of chunks(toSend.map(c => c.id), 100)) {
    const { error } = await admin.from('club_contacts').update(patch).in('id', part)
    if (error) throw new Error('Emails went out but could not be recorded: ' + error.message)
  }
  return { sent: toSend.length, failed: 0, joined: joined.length, remaining }
}
