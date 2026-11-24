// The life of an imported contact: saved, invited, maybe reminded once, joined or unsubscribed. And the exact words of the
// invite and the single reminder, so what the owner previews is what people receive. Client-safe.

export const REMINDER_AFTER_DAYS = 7
export const INTRO_MAX = 300
const DAY = 86400000

export type ContactStatus = 'imported' | 'invited' | 'joined'
export type Contact = {
  id: string; name: string; email: string; phone: string | null; lastPlayed: string | null
  userId: string | null; status: ContactStatus; invitedAt: string | null; remindedAt: string | null; unsubscribedAt: string | null
}

// Can still be emailed: not unsubscribed, no account yet.
export const canEmail = (c: Contact): boolean => !c.unsubscribedAt && !c.userId && c.status !== 'joined'
export const needsInvite = (c: Contact): boolean => canEmail(c) && c.status === 'imported'
// One reminder only: invited at least 7 days ago and never reminded. Once reminded, never again.
export const reminderDue = (c: Contact, nowMs: number): boolean =>
  canEmail(c) && c.status === 'invited' && !!c.invitedAt && !c.remindedAt && nowMs - Date.parse(c.invitedAt) >= REMINDER_AFTER_DAYS * DAY

export type ContactSummary = { notJoined: number; toInvite: number; invited: number; reminderDue: number; reminderSent: number; nextReminderOn: string | null; unsubscribed: number }
export function contactSummary(contacts: Contact[], nowMs: number): ContactSummary {
  const s: ContactSummary = { notJoined: 0, toInvite: 0, invited: 0, reminderDue: 0, reminderSent: 0, nextReminderOn: null, unsubscribed: 0 }
  let next: number | null = null
  for (const c of contacts) {
    if (c.unsubscribedAt) { if (!c.userId) s.unsubscribed++; continue }
    if (!canEmail(c)) continue
    s.notJoined++
    if (c.status === 'imported') s.toInvite++
    else if (c.status === 'invited') {
      s.invited++
      if (c.remindedAt) s.reminderSent++
      else if (reminderDue(c, nowMs)) s.reminderDue++
      else if (c.invitedAt) { const t = Date.parse(c.invitedAt) + REMINDER_AFTER_DAYS * DAY; if (next == null || t < next) next = t }
    }
  }
  s.nextReminderOn = next == null ? null : new Date(next).toISOString()
  return s
}

export const cleanIntro = (v: unknown): string => String(v ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, INTRO_MAX)

export type Copy = { subject: string; heading: string; intro: string; cta: string }
export function emailCopy(kind: 'invite' | 'remind', club: string, ownerLine = ''): Copy {
  const line = cleanIntro(ownerLine)
  if (kind === 'remind') return {
    subject: `Reminder: book at ${club} on PadelMate`,
    heading: `${club} is on PadelMate`,
    intro: `${line ? line + ' ' : ''}A quick reminder that you can book courts at ${club} on PadelMate. This is the only reminder we will send.`,
    cta: 'Set up my account',
  }
  return {
    subject: `${club} now takes bookings on PadelMate`,
    heading: `${club} now takes bookings on PadelMate`,
    intro: `${line ? line + ' ' : ''}Book courts in 30 seconds, join open games and see your history. ${club} has you as a customer, so we have set up an invite for you.`,
    cta: 'Set up my account',
  }
}
export const FOOTER_TEXT = (club: string) => `You are getting this because ${club} has you as a customer. Not you, or do not want these?`

// "invited 24 Nov", "not invited yet", "reminded 1 Dec" for a row in the list.
export function contactLabel(c: Contact): string {
  const d = (iso: string) => new Intl.DateTimeFormat('en-NZ', { day: 'numeric', month: 'short', timeZone: 'Pacific/Auckland' }).format(new Date(iso))
  if (c.status === 'invited' && c.remindedAt) return `reminded ${d(c.remindedAt)}`
  if (c.status === 'invited' && c.invitedAt) return `invited ${d(c.invitedAt)}`
  return 'not invited yet'
}
