// Server-only: keeps club accounts (owner, front desk) on their own side. A manager who is in
// Manager view is sent to Today when they open a player page, whatever the club/player split
// setting says; "View as Player" is how they get across. The page they wanted is passed on so
// Today can offer a one-tap switch (a notification about their own booking still gets them there).
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { splitOn } from '@/lib/club-access'
import { VIEW_COOKIE, isManagerRole, resolveViewMode } from '@/lib/view-mode'

export const PLAYER_PAGES: Record<string, string> = {
  '/home': 'Home', '/book': 'Book a court', '/mybookings': 'My bookings', '/find-a-game': 'Open play', '/membership': 'Membership', '/record-match': 'Record a match',
}

export async function keepClubAccountsOut(supabase: any, path?: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
  const role = (profile as any)?.role
  if (!isManagerRole(role)) return
  if (resolveViewMode(role, cookies().get(VIEW_COOKIE)?.value, splitOn()) !== 'manager') return // they chose Player view
  redirect(path && PLAYER_PAGES[path] ? `/admin/today?player=${encodeURIComponent(path)}` : '/admin/today')
}
