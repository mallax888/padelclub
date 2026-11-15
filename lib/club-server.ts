// Server-only helpers for club requests and team invites (service-role client).
import { resend, emailFrom } from '@/lib/resend'
import { renderEmailShell } from '@/lib/email-template'
import { getAppUrl } from '@/lib/env'
import { hashToken, inviteState, type InviteState } from '@/lib/club-access'

export const MIGRATION_MESSAGE = "Starting a club isn't switched on yet: the database change 033 has not been run."

// Postgres "undefined table" (42P01) or PostgREST "table not in the schema cache".
export const tableMissing = (error: any): boolean =>
  !!error && (error.code === '42P01' || error.code === 'PGRST205' || /schema cache|does not exist/i.test(String(error.message ?? '')))

const esc = (s: string): string => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

// Best effort: a failed email never loses the request or invite (the link is also shown to whoever created it).
export async function sendClubEmail(o: { to: string; subject: string; heading: string; intro: string; ctaText?: string; ctaUrl?: string; footer: string }): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false
  try {
    await resend.emails.send({
      from: emailFrom(), to: o.to, subject: o.subject,
      html: renderEmailShell({ heading: esc(o.heading), intro: o.intro, ctaText: o.ctaText, ctaUrl: o.ctaUrl, footer: esc(o.footer) }),
    })
    return true
  } catch (e) {
    console.error('Could not send a club email to', o.to, e)
    return false
  }
}
export { esc as escapeHtml }

export const joinLink = (request: Request, token: string): string => `${getAppUrl(request)}/club/join/${token}`

export async function lookupInvite(admin: any, token: string): Promise<{ state: InviteState | 'missing'; invite: any | null }> {
  if (typeof token !== 'string' || token.length < 20 || token.length > 200) return { state: 'missing', invite: null }
  const { data, error } = await admin.from('team_invites').select('*').eq('token_hash', hashToken(token)).maybeSingle()
  if (error || !data) return { state: 'missing', invite: null }
  return { state: inviteState(data, Date.now()), invite: data }
}

export async function emailHasAccount(admin: any, email: string): Promise<boolean> {
  const { data } = await admin.from('profiles').select('id').ilike('email', email).limit(1)
  return (data ?? []).length > 0
}
