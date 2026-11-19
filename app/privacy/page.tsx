import Link from 'next/link'
import { LegalPage, H2, P, UL, B, Note } from '@/components/legal/LegalPage'
import { BUSINESS } from '@/lib/business'

export const metadata = { title: 'Privacy' }

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy">
      <P>{BUSINESS.legalName} (&quot;we&quot;, &quot;us&quot;), trading as {BUSINESS.tradingName}, respects your privacy. This policy explains what personal information we collect, why, who sees it, and your rights. We follow the New Zealand Privacy Act 2020.</P>

      <H2>What we collect</H2>
      <UL>
        <li><B>Your account:</B> name, nickname, email address, phone number (if you give one), your home club, and your padel level.</li>
        <li><B>Your bookings and games:</B> courts and times you book, who you play with, matches and results you record, tournaments and ladders you join.</li>
        <li><B>Payments:</B> what you paid and when. Card details go straight to Stripe. We never see or store your full card number.</li>
        <li><B>Messages and reminders:</B> the emails and notifications we send you, and your notification settings.</li>
        <li><B>Technical information:</B> basic device and error information so we can keep the service working, and a sign-in cookie.</li>
        <li><B>Location:</B> if you tap &quot;Find a club near me&quot;, your phone or browser works out your position to show nearby clubs. We don&apos;t keep it.</li>
      </UL>

      <H2>Why we use it</H2>
      <UL>
        <li>To run your account, make and manage bookings, and take and refund payments.</li>
        <li>To send booking confirmations, reminders, payment requests and other messages about your bookings.</li>
        <li>To show other players in a game your name or nickname and level, so games are fairly matched.</li>
        <li>To keep the service safe, fix problems and meet our legal and tax obligations.</li>
      </UL>
      <P>We only send marketing messages if you&apos;ve said you want them, and every one has an unsubscribe link, as the Unsolicited Electronic Messages Act 2007 requires.</P>

      <H2>Who we share it with</H2>
      <UL>
        <li><B>The club you book with</B> sees the details it needs to run your booking (such as your name, contact details and level).</li>
        <li><B>Other players</B> in a game or booking you join see your name or nickname and level.</li>
        <li><B>Our service providers</B>, who only handle your information to provide their service to us: Stripe (payments), Supabase (our database and sign-in, hosted in Sydney, Australia), Vercel (hosting), Resend (sending emails), Sentry (error monitoring), a live chat provider (tawk.to), and your browser&apos;s notification service if you turn on reminders. If a club connects Xero, its accounting records are sent to Xero.</li>
      </UL>
      <P>Some of these providers store or process information outside New Zealand, including in Australia and the United States. We only use providers that protect personal information to a standard comparable to the Privacy Act. We don&apos;t sell your personal information.</P>

      <H2>How long we keep it</H2>
      <P>We keep your account and booking records while your account is open. We keep financial records for 7 years, because New Zealand tax law requires it. When you close your account we delete or de-identify the rest unless the law says we have to keep it.</P>

      <H2>Keeping it safe</H2>
      <P>Connections to {BUSINESS.tradingName} are encrypted. Access to personal information is limited to people who need it to run the service. If a privacy breach is likely to cause serious harm, we will tell the people affected and the Office of the Privacy Commissioner, as the Privacy Act requires.</P>

      <H2>Your rights</H2>
      <UL>
        <li>You can ask for a copy of the personal information we hold about you, and ask us to correct it.</li>
        <li>You can ask us to close your account and delete your information.</li>
        <li>If you think we&apos;ve handled your information badly, tell us first on our <Link href="/contact" style={{ color: 'var(--brand-primary-text)' }}>Contact</Link> page and we&apos;ll respond promptly. You can also complain to the Office of the Privacy Commissioner (privacy.org.nz).</li>
      </UL>

      <H2>Cookies and similar technology</H2>
      <P>We use cookies and local storage that are needed to keep you signed in and remember simple choices such as light or dark mode. We don&apos;t use advertising cookies.</P>

      <H2>Children</H2>
      <P>{BUSINESS.tradingName} is for people aged 16 or over. If you are younger, a parent or guardian should make bookings for you.</P>

      <H2>People outside New Zealand</H2>
      <P>If you use {BUSINESS.tradingName} from Australia or South Africa, the privacy laws where you live may also protect you, and nothing here limits them.</P>

      <H2>Changes</H2>
      <P>If we make a material change to this policy, we will tell you before it takes effect.</P>

      <Note>Privacy contact: use the details on our <Link href="/contact" style={{ color: 'var(--brand-primary-text)' }}>Contact</Link> page and mark your message &quot;Privacy&quot;.</Note>
    </LegalPage>
  )
}
