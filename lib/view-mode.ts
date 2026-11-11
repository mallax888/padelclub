// Which "side" of the app a person is looking at. Staff and admins (managers)
// can use the app as a manager -- Today screen, Board, Bookings, Analytics --
// or as an ordinary player. Everyone else is always a player and never sees the
// switch. Remembered in a cookie so the server can send a manager to the right
// home screen and draw the right navigation on the first paint.

export const VIEW_COOKIE = 'pc_view'
export type ViewMode = 'manager' | 'player'

export const isManagerRole = (role: string | null | undefined): boolean => role === 'staff' || role === 'admin'

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
