import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import LadderBoard from '@/components/ladders/LadderBoard'

export default async function LadderPage({ params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', session!.user.id).single()
  const isStaff = profile?.role === 'staff' || profile?.role === 'admin'

  const { data: ladder } = await supabase.from('ladders').select('*').eq('id', params.id).single()
  if (!ladder) notFound()

  const { data: entries } = await supabase
    .from('ladder_entries')
    .select('*, profiles(full_name, nickname)')
    .eq('ladder_id', params.id)
    .order('position', { ascending: true })

  const { data: challenges } = await supabase
    .from('ladder_challenges')
    .select('*')
    .eq('ladder_id', params.id)
    .order('created_at', { ascending: false })

  return (
    <LadderBoard
      ladder={ladder}
      entries={entries ?? []}
      challenges={challenges ?? []}
      isStaff={isStaff}
      currentUserId={session!.user.id}
    />
  )
}
