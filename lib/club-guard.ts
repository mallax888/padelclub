// Server-only: when the club/player split is switched on, club accounts (owner, front desk)
// are sent to their own dashboard instead of the player pages.
import { redirect } from 'next/navigation'
import { splitOn } from '@/lib/club-access'
import { isManagerRole } from '@/lib/view-mode'

export async function keepClubAccountsOut(supabase: any): Promise<void> {
  if (!splitOn()) return
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
  if (isManagerRole((profile as any)?.role)) redirect('/admin/today')
}
