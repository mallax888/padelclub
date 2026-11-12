import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { invitePreview, inviteState, loadInvite } from '@/lib/invites'
import JoinInvite from '@/components/invites/JoinInvite'

export const metadata = { title: 'Join a game' }

// Outside the (app) group on purpose. That layout sends anyone without a
// session to the login page, which is exactly wrong here: the person opening
// this link is, by definition, somebody who may not have an account yet, and
// they need to see what they've been invited to before being asked to make one.
export const dynamic = 'force-dynamic'

export default async function JoinPage({ params }: { params: { token: string } }) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  // This page is outside the (app) layout, which is what normally sends a new
  // account through onboarding first. Without the same check here, a friend who
  // had just confirmed their email could take the seat before ever choosing a
  // name or a home club, and then be bounced into onboarding from My Bookings
  // with the invite forgotten. Sent there with the invite as the destination,
  // they come straight back.
  if (session) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_completed')
      .eq('id', session.user.id)
      .single()
    if (profile && !profile.onboarding_completed) {
      redirect(`/onboarding?next=${encodeURIComponent(`/join/${params.token}`)}`)
    }
  }

  // The admin client, because the visitor has no standing to read this booking
  // -- they are not on it yet -- and the token is the credential. What comes
  // back to the page is deliberately thin: a first name, the court, the time and
  // the share. No email, no phone number, nobody else on the booking.
  const { record, featureMissing } = await loadInvite(createAdminClient(), params.token)

  if (featureMissing) {
    return <JoinInvite token={params.token} state="unavailable" preview={null} signedIn={!!session} isOwnBooking={false} alreadyJoined={false} />
  }
  if (!record) {
    return <JoinInvite token={params.token} state="invalid" preview={null} signedIn={!!session} isOwnBooking={false} alreadyJoined={false} />
  }

  return (
    <JoinInvite
      token={params.token}
      state={inviteState(record)}
      preview={invitePreview(record)}
      signedIn={!!session}
      isOwnBooking={!!session && record.booking.user_id === session.user.id}
      alreadyJoined={!!session && record.claimedBy === session.user.id}
      // Joined but not yet paid: the page offers to pay rather than just
      // saying "you're in", which left a friend with no way to settle up.
      unpaidSplitId={!!session && record.claimedBy === session.user.id && record.seatStatus === 'pending' ? record.splitId : null}
    />
  )
}
