// Which "side" of the app a person is looking at. Staff and admins (managers)
// can use the app as a manager -- Today screen, Board, Bookings, Analytics --
// or as an ordinary player. Everyone else is always a player and never sees the
// switch. Remembered in a cookie so the server can send a manager to the right
// home screen and draw the right navigation on the first paint.

export const VIEW_COOKIE = 'pc_view'
export type ViewMode = 'manager' | 'player'

export const isManagerRole = (role: string | null | undefined): boolean => role === 'staff' || role === 'admin'

// Two levels of manager. An Owner (role 'admin') sees everything. Front desk
// (role 'staff') runs the day -- Today, Board, Bookings, Members, competitions --
// but sees no money (revenue, reports, prices) and none of the club's settings.
export const isOwnerRole = (role: string | null | undefined): boolean => role === 'admin'
export const roleLabel = (role: string | null | undefined): string | null =>
  role === 'admin' ? 'Owner' : role === 'staff' ? 'Front desk' : null

export const ADMIN_TABS = ['board', 'analytics', 'reports', 'bookings', 'members', 'courts', 'xero'] as const
export type AdminTab = typeof ADMIN_TABS[number]
export const FRONT_DESK_TABS: readonly AdminTab[] = ['board', 'bookings', 'members']
export const canOpenTab = (role: string | null | undefined, tab: string): boolean =>
  isOwnerRole(role) || (FRONT_DESK_TABS as readonly string[]).includes(tab)

// A manager is in manager mode unless they have chosen player mode.
export function resolveViewMode(role: string | null | undefined, cookieValue: string | null | undefined): ViewMode {
  if (!isManagerRole(role)) return 'player'
  return cookieValue === 'player' ? 'player' : 'manager'
}

export const homePathFor = (mode: ViewMode): string => (mode === 'manager' ? '/admin/today' : '/book')

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60

// Browser only.
export function rememberViewMode(mode: ViewMode) {
  if (typeof document === 'undefined') return
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${VIEW_COOKIE}=${mode}; Max-Age=${ONE_YEAR_SECONDS}; Path=/; SameSite=Lax${secure}`
}
