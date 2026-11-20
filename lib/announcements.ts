// Club announcements: one short message from an owner to a club's players. Pure rules (no database, no React)
// so the checks and the wording are tested on their own; the sending is in lib/announcements-server.ts.

export const TITLE_MAX = 80
export const BODY_MAX = 500
export const HOME_DAYS = 7
export const MAX_EMAILS = 300
export const MAX_TOLD = 1000

export type AnnouncementInput = { title: string; body: string; push: boolean; email: boolean; home: boolean }

export function validateAnnouncement(b: any): { value: AnnouncementInput } | { error: string } {
  const title = typeof b?.title === 'string' ? b.title.trim() : ''
  const body = typeof b?.body === 'string' ? b.body.trim() : ''
  if (title.length === 0) return { error: 'Write what you want to tell them.' }
  if (title.length > TITLE_MAX) return { error: `Keep the headline to ${TITLE_MAX} characters or fewer.` }
  if (body.length > BODY_MAX) return { error: `Keep the message to ${BODY_MAX} characters or fewer.` }
  const push = b?.push !== false, email = b?.email === true, home = b?.home !== false
  if (!push && !email && !home) return { error: 'Choose at least one way to tell them.' }
  return { value: { title, body, push, email, home } }
}

// When a notice stops showing on Home.
export const noticeExpiry = (nowMs: number): string => new Date(nowMs + HOME_DAYS * 86400000).toISOString()

// The single line in the bell: "Court 2 closed Saturday: We are resurfacing it."
export function bellMessage(title: string, body: string): string {
  const text = body ? `${title}: ${body}` : title
  return text.length > 220 ? `${text.slice(0, 217)}...` : text
}

// "just now", "2h ago", "3d ago".
export function ageLabel(createdIso: string, nowMs: number): string {
  const mins = Math.max(0, Math.floor((nowMs - Date.parse(createdIso)) / 60000))
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
