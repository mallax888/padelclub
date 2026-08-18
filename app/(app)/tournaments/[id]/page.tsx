import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import TournamentHub from '@/components/tournaments/TournamentHub'

export default async function TournamentPage({ params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', session!.user.id).single()
  const isStaff = profile?.role === 'staff' || profile?.role === 'admin'

  const { data: tournament } = await supabase.from('tournaments').select('*').eq('id', params.id).single()
  if (!tournament) notFound()

  const { data: tournamentPlayers } = await supabase
    .from('tournament_players')
    .select('*, profiles(full_name, nickname)')
    .eq('tournament_id', params.id)

  const { data: matches } = await supabase
    .from('tournament_matches')
    .select('*')
    .eq('tournament_id', params.id)
    .order('round_number', { ascending: true })

  const { data: allPlayers } = await supabase
    .from('profiles')
    .select('id, full_name, nickname')
    .not('role', 'eq', 'staff')
    .order('full_name', { ascending: true })

  return (
    <TournamentHub
      tournament={tournament}
      tournamentPlayers={tournamentPlayers ?? []}
      matches={matches ?? []}
      allPlayers={allPlayers ?? []}
      isStaff={isStaff}
      currentUserId={session!.user.id}
    />
  )
}
