// Where a person was going before the app asked them to sign in.
//
// The auth pages used to send everyone to /book, and the callback and the end
// of onboarding did the same, so a link that needed an account lost its
// destination the moment someone created one: a friend who opened an invite,
// signed up, confirmed their email and logged in would land on the booking
// page with no idea the game they'd been asked to was waiting for them.
//
// Two ways to remember, because sign-up has two shapes. An explicit ?next=
// survives anything that keeps the URL (signup -> login). A short-lived cookie
// survives the part that doesn't: the confirmation email opens a fresh page
// that has never heard of ?next=, but it is the same browser, and the cookie
// is still there.
//
// Client-safe on purpose (no server imports): the login, signup and onboarding
// pages are client components and use this directly.

export const INVITE_COOKIE = 'pc_invite'

// What lib/invites.ts generates: 18 random bytes, base64url -> 24 characters.
// Matched loosely on length so a future change to the token doesn't silently
// turn every existing link into "not valid".
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,64}$/

// A path on this site and nothing else. Anything that could carry a person
// off-site -- a full URL, a protocol-relative "//host", a backslash that some
// browsers read as a slash -- is refused, because ?next= is attacker-controlled.
export function safeNext(raw: string | null | undefined): string | null {
  if (!raw) return null
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return null
  return raw
}

export function joinPathFor(token: string | null | undefined): string | null {
  return token && TOKEN_PATTERN.test(token) ? `/join/${token}` : null
}

const ONE_DAY_SECONDS = 24 * 60 * 60

export function rememberInvite(token: string) {
  if (typeof document === 'undefined' || !TOKEN_PATTERN.test(token)) return
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${INVITE_COOKIE}=${token}; Max-Age=${ONE_DAY_SECONDS}; Path=/; SameSite=Lax${secure}`
}

export function forgetInvite() {
  if (typeof document === 'undefined') return
  document.cookie = `${INVITE_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`
}

function readInviteCookie(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.split('; ').find(c => c.startsWith(`${INVITE_COOKIE}=`))
  return match ? decodeURIComponent(match.slice(INVITE_COOKIE.length + 1)) : null
}

// For the pages that send someone onward after signing in: an explicit ?next=
// wins, then a remembered invite, then the default.
// The fallback is the front door ('/'), which sends each person to their own
// home: players to /book, managers to the Today screen.
export function returnTarget(fallback = '/'): string {
  if (typeof window === 'undefined') return fallback
  const explicit = safeNext(new URLSearchParams(window.location.search).get('next'))
  return explicit ?? joinPathFor(readInviteCookie()) ?? fallback
}

// ?next= carried onto the next auth page (signup -> login), or nothing.
export function nextQuery(): string {
  if (typeof window === 'undefined') return ''
  const explicit = safeNext(new URLSearchParams(window.location.search).get('next'))
  return explicit ? `?next=${encodeURIComponent(explicit)}` : ''
}
