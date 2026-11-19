import Link from 'next/link'
import { LegalPage, H2, P, UL, B, Note } from '@/components/legal/LegalPage'
import { BUSINESS } from '@/lib/business'

export const metadata = { title: 'Terms for clubs' }

export default function ClubTermsPage() {
  return (
    <LegalPage title="Terms for clubs">
      <P>These terms are between {BUSINESS.legalName}, trading as {BUSINESS.tradingName}, and a club (&quot;you&quot;) that uses {BUSINESS.tradingName} to take bookings and payments. They sit alongside our general <Link href="/terms" style={{ color: 'var(--brand-primary-text)' }}>Terms of use</Link>.</P>

      <H2>1. What we provide</H2>
      <P>Booking, scheduling, payments, member and player tools, reports, and notifications for your club. You stay in charge of your courts, prices, opening hours, membership plans and rules.</P>

      <H2>2. Getting paid</H2>
      <UL>
        <li>Player payments go <B>directly to your own Stripe account</B>. We never hold your money.</li>
        <li>You must connect and keep a Stripe account in good standing, accept Stripe&apos;s own terms, and give Stripe the information it asks for.</li>
        <li>Stripe pays out to your bank account on its schedule. Stripe&apos;s card fees, and any refunds, disputes and chargebacks, are your responsibility as the club that took the payment.</li>
      </UL>

      <H2>3. Our fee</H2>
      <P>We charge a platform fee on each payment taken through {BUSINESS.tradingName}: a percentage, plus a fixed amount if one is set for your club. The fee that applies to your club is shown to you in the app under <B>Clubs and fees</B> before you connect. It is taken from each payment as it happens. If a payment is refunded in full, our fee on it is refunded too. We will tell you before any change to your fee, and a change does not apply to payments already made.</P>

      <H2>4. Your responsibilities</H2>
      <UL>
        <li>Your prices, deals and membership plans must be accurate, and prices shown to consumers must include GST where you are GST-registered. You are responsible for your own tax.</li>
        <li>You must run your courts safely and honour the bookings made with you. If you cancel or can&apos;t provide a court, players are entitled to a refund.</li>
        <li>You must follow the cancellation and refund rules shown in the app, and your obligations under the Consumer Guarantees Act 1993 and Fair Trading Act 1986 (or the consumer law where your club is).</li>
        <li>You are responsible for the people you give access to, such as staff and managers.</li>
      </UL>

      <H2>5. Player information</H2>
      <P>You will see the information about players that you need to run your bookings. Use it only for running your club, keep it safe, and follow the Privacy Act 2020 (or the privacy law where your club is). Our <Link href="/privacy" style={{ color: 'var(--brand-primary-text)' }}>Privacy policy</Link> explains what we do with it.</P>

      <H2>6. Availability and our responsibility</H2>
      <P>We work hard to keep {BUSINESS.tradingName} running, but we can&apos;t promise it will always be available or error-free. To the extent the law allows, we are not responsible for indirect or consequential loss, and our total responsibility to you in any 12 months is limited to the fees you paid us in that period. Nothing here limits a liability that can&apos;t be limited by law.</P>

      <H2>7. Ending the agreement</H2>
      <P>You can stop using {BUSINESS.tradingName} at any time. We may suspend or end a club&apos;s access for serious or repeated breaches, with notice where that is reasonable. Bookings already made and money already owed are still honoured and refunded as set out in our <Link href="/refunds" style={{ color: 'var(--brand-primary-text)' }}>Refunds and cancellations</Link> page.</P>

      <H2>8. Changes, law and disputes</H2>
      <P>We will tell you before a material change to these terms applies to you. These terms are governed by New Zealand law. If we have a disagreement, we will both try to sort it out in good faith first.</P>

      <Note>Questions about your club&apos;s account or fee? See our <Link href="/contact" style={{ color: 'var(--brand-primary-text)' }}>Contact</Link> page.</Note>
    </LegalPage>
  )
}
