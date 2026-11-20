'use client'

import BookingTicket from '@/components/booking/BookingTicket'

// "You're booked!": shown on My bookings when Stripe sends the player back after paying. The ball drops, squashes, bounces
// twice more, and then the tick draws itself. No confetti and no sound. With reduced motion the ball just sits there, ticked.
export default function BookedCelebration({ firstName, ticket, onDone }: {
  firstName: string
  ticket: { courtName: string; dateLabel: string; time: string; endTime: string; lengthLabel: string; venueName: string; you: string; price: string } | null
  onDone: () => void
}) {
  return (
    <section data-testid="booked-celebration" aria-label="Booking confirmed" className="flex flex-col items-center text-center mb-5">
      <style>{`
        @keyframes pc-drop{0%{transform:translateY(-120px) scale(1,1);opacity:0;animation-timing-function:ease-in}6%{opacity:1}26%{transform:translateY(0) scale(1,1)}30%{transform:translateY(6px) scale(1.22,.74);animation-timing-function:ease-out}38%{transform:translateY(-46px) scale(.95,1.06);animation-timing-function:ease-in}48%{transform:translateY(0) scale(1.1,.88)}53%{transform:translateY(0) scale(1,1);animation-timing-function:ease-out}60%{transform:translateY(-16px) scale(.99,1.02);animation-timing-function:ease-in}68%,100%{transform:translateY(0) scale(1,1)}}
        @keyframes pc-shadow{0%{transform:scaleX(.3);opacity:.05}26%{transform:scaleX(1);opacity:.35}38%{transform:scaleX(.7);opacity:.2}48%{transform:scaleX(1);opacity:.35}60%{transform:scaleX(.88);opacity:.28}68%,100%{transform:scaleX(1);opacity:.32}}
        @keyframes pc-draw{0%,66%{stroke-dashoffset:60}82%,100%{stroke-dashoffset:0}}
        @keyframes pc-rise{0%{transform:translateY(12px);opacity:0}100%{transform:none;opacity:1}}
        .pc-ball{animation:pc-drop 2.4s both}.pc-shadow{animation:pc-shadow 2.4s both}.pc-tick{stroke-dasharray:60;stroke-dashoffset:60;animation:pc-draw 2.4s both}
        .pc-title{animation:pc-rise .5s 1.5s ease-out both}.pc-ticket{animation:pc-rise .5s 1.8s ease-out both}
        @media (prefers-reduced-motion:reduce){.pc-ball,.pc-shadow,.pc-title,.pc-ticket{animation:none}.pc-tick{animation:none;stroke-dashoffset:0}}
      `}</style>
      <div className="relative" style={{ width: 108, height: 124, marginTop: 6 }}>
        <div className="pc-ball" style={{ width: 96, height: 96, margin: '0 auto' }} aria-hidden>
          <svg width="96" height="96" viewBox="0 0 78 78">
            <defs>
              <radialGradient id="pc-g" cx="35%" cy="30%" r="75%"><stop offset="0" stopColor="#eaff7a" /><stop offset="0.55" stopColor="#d4f53c" /><stop offset="1" stopColor="#a8c81d" /></radialGradient>
              <clipPath id="pc-c"><circle cx="39" cy="39" r="39" /></clipPath>
            </defs>
            <circle cx="39" cy="39" r="39" fill="url(#pc-g)" />
            <g clipPath="url(#pc-c)" fill="none" stroke="#f3ffa8" strokeOpacity="0.9" strokeWidth="2.4" strokeLinecap="round"><path d="M-4 10 C 20 24, 20 54, -4 68" /><path d="M82 10 C 58 24, 58 54, 82 68" /></g>
            <path className="pc-tick" d="M24 41 L35 52 L56 28" fill="none" stroke="#17240a" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="pc-shadow" style={{ position: 'absolute', left: 14, right: 14, top: 108, height: 10, borderRadius: '50%', background: '#000' }} aria-hidden />
      </div>
      <div className="pc-title">
        <h2 className="text-[30px] font-black leading-tight" style={{ letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>You&apos;re booked!</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>See you on court{firstName ? `, ${firstName}` : ''}</p>
      </div>
      {ticket && (
        <div className="pc-ticket w-full mt-5 text-left">
          <BookingTicket courtName={ticket.courtName} dateLabel={ticket.dateLabel} time={ticket.time} endTime={ticket.endTime} lengthLabel={ticket.lengthLabel}
            venueName={ticket.venueName} you={ticket.you} friends={[]} priceLabel="You paid" price={ticket.price} />
        </div>
      )}
      <button type="button" onClick={onDone} data-testid="booked-done" className="btn-main mt-4 w-full">Done</button>
    </section>
  )
}
