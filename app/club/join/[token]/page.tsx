import Link from 'next/link'
import ClubShell, { clubCard } from '@/components/club/ClubShell'
import JoinForm from '@/components/club/JoinForm'
import { createAdminClient } from '@/lib/supabase-admin'
import { lookupInvite } from '@/lib/club-server'
import { scopeLabel, scopeOf } from '@/lib/team'
import { roleLabel } from '@/lib/view-mode'

export const metadata = { title: 'Join your club' }
export const dynamic = 'force-dynamic'

const WHY: Record<string, string> = {
  used: 'This invite was already used. If that was you, log in from the club log-in page.',
  cancelled: 'This invite was cancelled. Ask the owner to send you a new one.',
  expired: 'This invite has expired. Ask the owner to send you a new one.',
  missing: 'We could not find that invite. Check the link in your email.',
}

export default async function Page({ params }: { params: { token: string } }) {
  const { state, invite } = await lookupInvite(createAdminClient(), params.token)
  if (state !== 'ok') {
    return (
      <ClubShell>
        <div className="rounded-2xl p-6" style={clubCard} data-testid="invite-problem">
          <h1 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>We can&apos;t use this link</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{WHY[state]}</p>
          <p className="text-sm mt-5"><Link href="/club/login" className="font-semibold" style={{ color: 'var(--brand-primary-text)' }}>Club log in</Link></p>
        </div>
      </ClubShell>
    )
  }
  return <JoinForm token={params.token} email={invite.email} role={roleLabel(invite.role) ?? 'Team'} where={scopeLabel(scopeOf(invite))} />
}
