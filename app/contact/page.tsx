import { LegalPage, H2, P, UL, B } from '@/components/legal/LegalPage'
import { BUSINESS } from '@/lib/business'

export const metadata = { title: 'Contact' }

export default function ContactPage() {
  return (
    <LegalPage title="Contact us">
      <P>We&apos;re happy to help with bookings, payments, refunds, your account or anything about {BUSINESS.tradingName}.</P>

      <H2>The quickest way</H2>
      <P>Use the <B>chat button</B> at the bottom right of the app and the website. Tell us what happened and which booking it was about.</P>

      <H2>Our details</H2>
      <UL>
        <li><B>Business:</B> {BUSINESS.legalName}, trading as {BUSINESS.tradingName}, a New Zealand company{BUSINESS.companyNumber ? ` (company number ${BUSINESS.companyNumber})` : ''}.</li>
        {BUSINESS.supportEmail && <li><B>Email:</B> <a href={`mailto:${BUSINESS.supportEmail}`} style={{ color: 'var(--brand-primary-text)' }}>{BUSINESS.supportEmail}</a></li>}
        {BUSINESS.phone && <li><B>Phone:</B> {BUSINESS.phone}</li>}
        {BUSINESS.address && <li><B>Address:</B> {BUSINESS.address}</li>}
        {BUSINESS.gstNumber && <li><B>GST number:</B> {BUSINESS.gstNumber}</li>}
      </UL>

      <H2>Privacy requests</H2>
      <P>To ask for a copy of your information, correct it, or close your account, contact us and mark your message &quot;Privacy&quot;.</P>

      <H2>If you&apos;re not happy</H2>
      <P>Tell us what went wrong and what you&apos;d like us to do. We&apos;ll reply promptly and try to put it right. If we can&apos;t sort it out, you can take it to the Disputes Tribunal, or for privacy matters, the Office of the Privacy Commissioner (privacy.org.nz).</P>
    </LegalPage>
  )
}
