import Link from 'next/link'
import { LegalPage, H2, P, UL, B, Note } from '@/components/legal/LegalPage'
import { BUSINESS } from '@/lib/business'

export const metadata = { title: 'Refunds and cancellations' }

export default function RefundsPage() {
  return (
    <LegalPage title="Refunds and cancellations">
      <P>This page explains what you get back when you cancel or change a booking. It follows the rules built into the app, so what you read here is what happens. It sits alongside, and does not limit, your rights under the Consumer Guarantees Act 1993 and the Fair Trading Act 1986.</P>

      <H2>If you cancel a booking</H2>
      <UL>
        <li><B>24 hours or more before it starts:</B> full refund to the card you paid with. It usually appears within 5–10 business days. A booking paid with account credit gets the credit back.</li>
        <li><B>Less than 24 hours before it starts:</B> 50% of what you paid comes back as account credit to use on a future booking.</li>
        <li><B>Not paid yet:</B> cancel at any time with no charge.</li>
      </UL>
      <P>To cancel, open <B>My bookings</B>, choose the booking and tap <B>Cancel</B>. The app shows you what you will get back before you confirm.</P>

      <H2>Changing the day or time</H2>
      <P>You can reschedule to another date or time, at no charge, any time before the 24-hour mark, if the new time is available.</P>

      <H2>Split bookings</H2>
      <UL>
        <li>If the person who booked cancels, <B>everyone else on the booking is refunded in full</B>, whatever the notice.</li>
        <li>If the court is released because some shares were not paid in time, <B>everyone who had paid is refunded in full</B>, including the person who booked.</li>
        <li>Unpaid shares are simply withdrawn. No one is charged for a share they didn&apos;t pay.</li>
      </UL>

      <H2>Weekly regulars</H2>
      <P>Each held week is paid separately, by the date shown (48 hours before play). A week that isn&apos;t paid is released with no charge. You can skip a week with at least 24 hours&apos; notice, and the normal cancellation rules above apply to weeks you have already paid for.</P>

      <H2>If the club or we cancel</H2>
      <P>If a court isn&apos;t available because the club or {BUSINESS.tradingName} cancels or can&apos;t provide it, you get a <B>full refund</B>, or a free move to another time if you prefer.</P>

      <H2>Memberships and credit</H2>
      <P>If a membership isn&apos;t what was described, or something went wrong when you bought it, contact us and we&apos;ll put it right. Account credit is applied to your future bookings as shown in your account.</P>

      <H2>When something goes wrong</H2>
      <P>If a booking doesn&apos;t match what you paid for (for example a double-booked court, or one that wasn&apos;t ready), you are entitled to have it put right, to a price reduction, or to a refund under New Zealand consumer law. That is in addition to anything on this page. Please tell us or the club as soon as you can.</P>

      <H2>How refunds are paid</H2>
      <P>Refunds go back to the original payment method through Stripe, our payment provider. Your bank decides how fast it shows on your statement, which is normally 5–10 business days. If a refund hasn&apos;t arrived after that, <Link href="/contact" style={{ color: 'var(--brand-primary-text)' }}>contact us</Link> and we&apos;ll chase it.</P>

      <Note>Please contact us before asking your bank to reverse a payment. We can usually sort it out faster.</Note>
    </LegalPage>
  )
}
