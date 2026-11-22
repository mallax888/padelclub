// How people get onto the club side of PadelMate, as pure rules (no database, no React) so
// they are tested on their own.
//   * Players sign up themselves and can only ever be players.
//   * An owner is created by the platform admin approving a "Start a club" request.
//   * Front desk (and more owners) are created only by an owner's emailed invite.
// A role is never chosen on a form: it always comes from an approval or an invite.
import { createHash, randomBytes } from 'node:crypto'
import { isTeamRole, isValidScope, covers, scopeColumns, type Reach, type TeamScope } from '@/lib/team'

export const INVITE_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export const normalEmail = (s: unknown): string => String(s ?? '').trim().toLowerCase()
export const isEmail = (s: string): boolean => s.length <= 254 && EMAIL_RE.test(s)
const clean = (s: unknown, max: number): string => String(s ?? '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)

// ---------------------------------------------------------------- the switch
// Keeping club accounts out of the player side is switched on with one setting
// (CLUB_PLAYER_SPLIT=on), so a club can be moved over deliberately. Off = exactly
// how the app behaved before: managers may still use "View as Player".
export const splitOn = (env: Record<string, string | undefined> = process.env): boolean => env.CLUB_PLAYER_SPLIT === 'on'

// ---------------------------------------------------------------- start a club
export type ClubRequestInput = {
  clubName: string; country: string; city: string; address: string; courts: number | null; phone: string; contactName: string; email: string
}
export type ClubRequestResult = { ok: true; value: ClubRequestInput } | { ok: false; error: string; field?: string }

export function validateClubRequest(raw: any): ClubRequestResult {
  const v: ClubRequestInput = {
    clubName: clean(raw?.clubName, 80), country: clean(raw?.country, 60), city: clean(raw?.city, 60), address: clean(raw?.address, 140),
    courts: null, phone: clean(raw?.phone, 30), contactName: clean(raw?.contactName, 80), email: normalEmail(raw?.email),
  }
  const courts = Number(raw?.courts)
  if (raw?.courts !== undefined && raw?.courts !== '' && raw?.courts !== null) {
    if (!Number.isInteger(courts) || courts < 1 || courts > 100) return { ok: false, field: 'courts', error: 'Enter how many courts you have, from 1 to 100.' }
    v.courts = courts
  }
  if (v.clubName.length < 2) return { ok: false, field: 'clubName', error: 'Enter your club name.' }
  if (v.country.length < 2) return { ok: false, field: 'country', error: 'Enter the country.' }
  if (v.city.length < 2) return { ok: false, field: 'city', error: 'Enter the city.' }
  if (v.contactName.length < 2) return { ok: false, field: 'contactName', error: 'Enter your name.' }
  if (!isEmail(v.email)) return { ok: false, field: 'email', error: 'Enter a work email we can reach you on.' }
  if (v.phone && !/^[0-9 +()\-]{6,30}$/.test(v.phone)) return { ok: false, field: 'phone', error: 'Enter a phone number using digits only.' }
  return { ok: true, value: v }
}

// ---------------------------------------------------------------- invites
export function newInviteToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url')
  return { token, hash: hashToken(token) }
}
export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex')

export type InviteRow = { used_at?: string | null; cancelled_at?: string | null; expires_at: string }
export type InviteState = 'ok' | 'used' | 'cancelled' | 'expired'
export function inviteState(row: InviteRow, nowMs: number): InviteState {
  if (row.used_at) return 'used'
  if (row.cancelled_at) return 'cancelled'
  if (Date.parse(row.expires_at) <= nowMs) return 'expired'
  return 'ok'
}
export const inviteExpiry = (nowMs: number): string => new Date(nowMs + INVITE_DAYS * DAY_MS).toISOString()

export type InvitePlan =
  | { ok: true; email: string; role: 'admin' | 'staff'; columns: { managed_venue_slug: string | null; managed_country: string | null } }
  | { ok: false; status: number; error: string }

// Who may invite whom. Only an owner, only into clubs they cover themselves, and never
// someone who already has an account (a player account must not be quietly turned into a
// club account; they should use a different email, or be added from the existing list).
export function planInvite(input: { caller: { role: string; reach: Reach }; email: unknown; role: unknown; scope: unknown; emailHasAccount: boolean }): InvitePlan {
  if (input.caller.role !== 'admin') return { ok: false, status: 403, error: 'Only an owner can invite team members.' }
  const email = normalEmail(input.email)
  if (!isEmail(email)) return { ok: false, status: 400, error: 'Enter a valid email address.' }
  if (!isTeamRole(input.role)) return { ok: false, status: 400, error: 'Choose Owner or Front desk.' }
  if (!isValidScope(input.scope)) return { ok: false, status: 400, error: 'Choose which clubs they cover.' }
  if (!covers(input.caller.reach, input.scope as TeamScope)) return { ok: false, status: 403, error: 'You can only give access to clubs you cover yourself.' }
  if (input.emailHasAccount) return { ok: false, status: 409, error: 'That email already has a PadelMate account. Ask them to use a different email, or add them from the existing accounts below.' }
  return { ok: true, email, role: input.role, columns: scopeColumns(input.scope as TeamScope) }
}

export const validPassword = (p: unknown): p is string => typeof p === 'string' && p.length >= 8 && p.length <= 72

// ---------------------------------------------------------------- platform admin
// The platform admin is an owner with no club or country limit: the person who runs
// PadelMate itself. Only they see the club requests.
export const isPlatformAdmin = (caller: { role: string; reach: Reach } | null): boolean =>
  !!caller && caller.role === 'admin' && caller.reach.venueSlug === null && caller.reach.country === null
