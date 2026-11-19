import Link from 'next/link'
import { LegalPage, H2, P, UL, B, Note } from '@/components/legal/LegalPage'
import { BUSINESS } from '@/lib/business'

export const metadata = { title: 'Terms of use' }

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use">
      <P>These terms are between you and {BUSINESS.legalName}, a New Zealand company trading as {BUSINESS.tradingName} (&quot;we&quot;, &quot;us&quot;). They apply when you use the {BUSINESS.tradingName} website and app to find, book and pay for padel courts, join games and play in club events. Please read them with our <Link href="/refunds" style={{ color: 'var(--brand-primary-text)' }}>Refunds and cancellations</Link> and <Link href="/privacy" style={{ color: 'var(--brand-primary-text)' }}>Privacy</Link> pages.</P>

      <H2>1. What PadelClub is</H2>
      <P>{BUSINESS.tradingName} is booking software for padel clubs. The courts, coaching and events belong to the club. When you book a court, you are booking it <B>with that club</B>. We provide the platform, and we help the club take your payment through Stripe. We are not the operator of the courts.</P>

      <H2>2. Your account</H2>
      <UL>
        <li>You must be 16 or over to create an account. If you are younger, a parent or guardian needs to make bookings for you.</li>
        <li>Give us accurate details and keep your sign-in secure. You are responsible for what happens under your account.</li>
        <li>You can ask us to close your account at any time (see the Privacy page).</li>
      </UL>

      <H2>3. Bookings and prices</H2>
      <UL>
        <li>Prices are set by each club and shown in the club&apos;s local currency (New Zealand dollars for New Zealand clubs). Prices shown to you include GST where GST applies.</li>
        <li>A booking is confirmed once payment succeeds (or, for bookings that are held for you to pay later, once the hold is placed). Courts are held for the time you booked. If you are late, the booked time does not extend.</li>
        <li>Clubs may offer discounts, deals and membership plans. The price you see at checkout is the price you pay.</li>
        <li>If something is wrong with a booking (for example the court is double-booked or unavailable), tell us or the club straight away. We will fix it or refund you.</li>
      </UL>

      <H2>4. Splitting a booking and weekly regulars</H2>
      <UL>
        <li>The person who books can invite friends to pay their share. Each person pays only their own share, by the deadline shown in the app.</li>
        <li>If shares are not paid in time, the app tells the booker what happens next (for example, covering the unpaid shares, or releasing the court). If a court is released because shares were not paid, everyone who had paid is refunded in full.</li>
        <li>Weekly regulars hold the same court and time each week. Each held week must be paid by the date shown (48 hours before play). Unpaid weeks are released for others to book. You can skip a week with at least 24 hours&apos; notice.</li>
      </UL>

      <H2>5. Cancellations and refunds</H2>
      <P>Our <Link href="/refunds" style={{ color: 'var(--brand-primary-text)' }}>Refunds and cancellations</Link> page sets out exactly what you get back and when. Nothing there limits your rights under New Zealand consumer law.</P>

      <H2>6. Memberships and credit</H2>
      <P>Clubs can offer membership plans that give discounts and longer booking windows for a set period. Plans, prices and what they include are shown before you buy. Account credit may be issued when a booking is cancelled late; it is applied to your future bookings as shown in your account.</P>

      <H2>7. Playing and using the platform fairly</H2>
      <UL>
        <li>Follow the club&apos;s rules and the instructions of its staff. Be respectful to other players.</li>
        <li>Don&apos;t misuse the platform: no false bookings, no hoarding courts, no sharing other people&apos;s details, no attempts to break or overload the service.</li>
        <li>We may suspend or close accounts that breach these terms, after warning you where that is reasonable.</li>
      </UL>

      <H2>8. Safety</H2>
      <P>Padel is a physical sport. Clubs are responsible for their facilities and safety rules, and you are responsible for playing within your own ability. In New Zealand, personal injury is covered by ACC, and nothing in these terms limits any cover you have under the Accident Compensation Act 2001.</P>

      <H2>9. Your consumer rights</H2>
      <P>Nothing in these terms limits your rights under the Consumer Guarantees Act 1993, the Fair Trading Act 1986, or any other law that cannot be excluded. If you use {BUSINESS.tradingName} from Australia, South Africa or anywhere else, the consumer laws that apply to you where you live also continue to apply.</P>

      <H2>10. Our responsibility</H2>
      <P>We take reasonable care to keep {BUSINESS.tradingName} running and accurate, but we can&apos;t promise it will always be available or error-free. Subject to the rights above, and to the extent the law allows, we are not responsible for indirect or consequential loss (such as lost time or missed games), and our responsibility for any one problem is limited to the amount you paid for the booking involved. We are not responsible for things done by clubs or other players.</P>

      <H2>11. Changes to these terms</H2>
      <P>If we make a material change, we will tell you (by email or in the app) before it applies to you. A change does not apply to bookings you have already made. If you don&apos;t agree to a change, you can stop using the service and close your account.</P>

      <H2>12. Law and disputes</H2>
      <P>These terms are governed by New Zealand law. If you have a problem, please contact us first (see below) so we can try to sort it out. If we can&apos;t, you can use the Disputes Tribunal or the New Zealand courts.</P>

      <H2>13. Contact</H2>
      <P>{BUSINESS.legalName}{BUSINESS.companyNumber ? ` (company number ${BUSINESS.companyNumber})` : ''}. See our <Link href="/contact" style={{ color: 'var(--brand-primary-text)' }}>Contact</Link> page.</P>

      <Note>These terms are written in plain English to explain how {BUSINESS.tradingName} works. They don&apos;t replace the club&apos;s own rules for using its courts.</Note>
    </LegalPage>
  )
}
