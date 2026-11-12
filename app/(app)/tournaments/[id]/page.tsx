import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import { loadTeamCaller } from '@/lib/team-server'
import { canManage as canManageTournament } from '@/lib/tournament-server'
import TournamentHub from '@/components/tournaments/TournamentHub'

export const metadata = { title: 'Tournament' }

export default async function TournamentPage({ params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const caller = await loadTeamCaller()

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

  // Staff can change a tournament only at the clubs they look after.
  const canManage = !!caller && canManageTournament(caller, tournament)
  const { data: allPlayers } = canManage
    ? await supabase.from('profiles').select('id, full_name, nickname').not('role', 'eq', 'staff').order('full_name', { ascending: true })
    : { data: [] as { id: string; full_name: string | null; nickname: string | null }[] }

  return (
    <TournamentHub
      tournament={tournament as any}
      tournamentPlayers={(tournamentPlayers ?? []) as any}
      matches={(matches ?? []) as any}
      allPlayers={allPlayers ?? []}
      canManage={canManage}
      currentUserId={caller?.id ?? ''}
    />
  )
}
