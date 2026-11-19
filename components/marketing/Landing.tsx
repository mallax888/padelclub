import Link from 'next/link'
import { Manrope } from 'next/font/google'
import styles from './Landing.module.css'
import { BUSINESS, LEGAL_LINKS } from '@/lib/business'

const manrope = Manrope({ subsets: ['latin'], weight: ['500', '700', '800'] })

export default function Landing() {
  return (
    <div className={`${styles.field} ${manrope.className}`}>
      <nav className={styles.nav}>
        <div className={styles.brand}>
          <svg className={styles.brandball} width="38" height="38" viewBox="0 0 100 100" aria-hidden style={{ colorScheme: 'light' }}>
            <defs>
              <radialGradient id="landBall" cx="35%" cy="28%" r="75%"><stop offset="0%" stopColor="#F7FFD6" /><stop offset="40%" stopColor="#D4FF3D" /><stop offset="100%" stopColor="#8FAE1E" /></radialGradient>
              <clipPath id="landBallClip"><circle cx="50" cy="50" r="46" /></clipPath>
            </defs>
            <circle cx="50" cy="50" r="46" fill="url(#landBall)" />
            <g clipPath="url(#landBallClip)"><path d="M 50 4 C 20 20, 20 40, 50 50 C 80 60, 80 80, 50 96" fill="none" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" transform="rotate(25 50 50)" /></g>
            <ellipse cx="34" cy="28" rx="14" ry="9" fill="white" opacity="0.35" transform="rotate(-25 34 28)" />
          </svg>
          <div className={styles.brandword} aria-label="PadelClub">PADEL<span className={styles.brandclub}>CLUB</span></div>
        </div>
        <div className={styles.navActions}>
          <Link href="/auth/login" className={`${styles.btn} ${styles.btnLime} ${styles.btnNav}`} data-testid="landing-signin">Sign in</Link>
        </div>
      </nav>

      <div className={styles.wrap}>
        <section style={{ padding: '36px 0 44px', textAlign: 'center', color: 'var(--ink)' }} id="choose" aria-label="Choose how you use PadelClub" data-testid="two-doors">
          <h1 style={{ fontSize: 'clamp(28px, 5vw, 44px)', lineHeight: 1.12, fontWeight: 800, margin: 0, color: 'var(--ink)', border: 'none', padding: 0 }}>Padel, made simple.<br /><span className={styles.accent}>Which one are you?</span></h1>
          <p style={{ opacity: 0.8, margin: '12px auto 26px', maxWidth: 480 }}>One app for players and for the clubs that run the courts.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 16, maxWidth: 860, margin: '0 auto' }}>
            <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, padding: 24, textAlign: 'left' }} data-testid="door-player">
              <div style={{ width: 44, height: 44, borderRadius: 13, display: 'grid', placeItems: 'center', fontSize: 22, marginBottom: 12, background: 'rgba(47,112,204,0.22)' }} aria-hidden="true">🎾</div>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px', color: 'var(--ink)' }}>I&apos;m a player</h2>
              <p style={{ opacity: 0.8, fontSize: 14, margin: '0 0 14px' }}>Find a club near you and get on court.</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 18px', fontSize: 13, opacity: 0.85 }}>
                <li style={{ padding: '3px 0' }}><span style={{ color: '#34D399', fontWeight: 700 }}>✓</span>&nbsp; Book courts in seconds</li>
                <li style={{ padding: '3px 0' }}><span style={{ color: '#34D399', fontWeight: 700 }}>✓</span>&nbsp; Find a game at your level</li>
                <li style={{ padding: '3px 0' }}><span style={{ color: '#34D399', fontWeight: 700 }}>✓</span>&nbsp; Split the bill with friends</li>
              </ul>
              <Link href="/auth/signup" className={`${styles.btn} ${styles.btnLg}`} style={{ display: 'block', textAlign: 'center', background: 'var(--lime)', color: 'var(--lime-ink)' }}>Sign up as a player</Link>
              <p style={{ fontSize: 13, opacity: 0.75, marginTop: 12, textAlign: 'center' }}>Have an account? <Link href="/auth/login" style={{ textDecoration: 'underline', fontWeight: 600 }}>Log in</Link></p>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,212,0,0.35)', borderRadius: 20, padding: 24, textAlign: 'left' }} data-testid="door-club">
              <div style={{ width: 44, height: 44, borderRadius: 13, display: 'grid', placeItems: 'center', fontSize: 22, marginBottom: 12, background: 'rgba(255,212,0,0.16)' }} aria-hidden="true">🏟️</div>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px', color: 'var(--ink)' }}>I manage a club</h2>
              <p style={{ opacity: 0.8, fontSize: 14, margin: '0 0 14px' }}>Run courts, members and money in one place.</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 18px', fontSize: 13, opacity: 0.85 }}>
                <li style={{ padding: '3px 0' }}><span style={{ color: '#34D399', fontWeight: 700 }}>✓</span>&nbsp; Bookings, members and reports</li>
                <li style={{ padding: '3px 0' }}><span style={{ color: '#34D399', fontWeight: 700 }}>✓</span>&nbsp; Fill empty courts with offers</li>
                <li style={{ padding: '3px 0' }}><span style={{ color: '#34D399', fontWeight: 700 }}>✓</span>&nbsp; Invite your front desk team</li>
              </ul>
              <Link href="/club" className={`${styles.btn} ${styles.btnLg}`} style={{ display: 'block', textAlign: 'center', background: '#FFD400', color: '#1b1f24' }}>Sign up as a club manager</Link>
              <p style={{ fontSize: 13, opacity: 0.75, marginTop: 12, textAlign: 'center' }}>On a club team? <Link href="/club/login" style={{ textDecoration: 'underline', fontWeight: 600 }}>Club log in</Link></p>
            </div>
          </div>
          <p style={{ marginTop: 22, fontSize: 13, opacity: 0.75 }}><a href="#everything" style={{ textDecoration: 'none' }}>See how it works ↓</a></p>
        </section>

        <section className={styles.hero}>
          <div>
            <div className={styles.eyebrow}><span className={styles.dot} /> Padel booking, made simple</div>
            <h2 className={styles.heroTitle}>Book more.<br /><span className={styles.accent}>Wait less.</span></h2>
            <p className={styles.heroSub}>Find a court, split the bill, and track every match — all in one app built for padel clubs.</p>
            <div className={styles.heroCtas}>
              <Link href="/auth/signup" className={`${styles.btn} ${styles.btnLime} ${styles.btnLg}`}>Book a court</Link>
              <Link href="#everything" className={`${styles.btn} ${styles.btnGhost} ${styles.btnLg}`}>See how it works</Link>
            </div>
            <div className={styles.featGrid}>
              <div className={styles.feat}>
                <div className={styles.featIcon} style={{ background: 'var(--blue)' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>
                </div>
                <div className={styles.featText}><b>Smart booking</b><span>Live availability, instant confirmation</span></div>
              </div>
              <div className={styles.feat}>
                <div className={styles.featIcon} style={{ background: 'var(--teal)' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><circle cx="9" cy="8" r="3.2"/><path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6"/><path d="M17 8a3 3 0 110 6M22 20c0-2.6-2-4.8-5-5.6"/></svg>
                </div>
                <div className={styles.featText}><b>Invite &amp; split</b><span>Bring friends, split the cost fairly</span></div>
              </div>
              <div className={styles.feat}>
                <div className={styles.featIcon} style={{ background: 'var(--violet)' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 10h20"/></svg>
                </div>
                <div className={styles.featText}><b>Secure payments</b><span>Card, credits or membership — your call</span></div>
              </div>
              <div className={styles.feat}>
                <div className={styles.featIcon} style={{ background: 'var(--coral)' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/></svg>
                </div>
                <div className={styles.featText}><b>Track stats</b><span>Every score, streak and rank in one place</span></div>
              </div>
            </div>
          </div>

          <div className={styles.phones}>
            <div className={`${styles.phone} ${styles.phoneA}`}>
              <div className={styles.phoneScreen}>
                <div className={styles.psPad}>
                  <div className={styles.psGreet}>Good morning</div>
                  <div className={styles.psName}>Malcolm 👋</div>
                  <div className={styles.psCard}>
                    <div className={styles.cardLabel}>Next game</div>
                    <div className={styles.cardCourt}>Court 1 · Sat 10:40am</div>
                    <div className={styles.cardWhen}>Pacific Padel Takapuna</div>
                  </div>
                  <div className={styles.psCta}>Book a court</div>
                  <div className={styles.psRowLbl}>Nearby clubs</div>
                  <div className={styles.psVenues}>
                    <div className={styles.psVenue}><span>Takapuna</span></div>
                    <div className={styles.psVenue}><span>Albany</span></div>
                  </div>
                </div>
              </div>
            </div>
            <div className={`${styles.phone} ${styles.phoneB}`}>
              <div className={styles.phoneScreen}>
                <div className={styles.psBHead}>Select court</div>
                <div className={`${styles.psCourtRow} ${styles.psCourtRowSel}`}><div><div className={styles.courtName}>Court 1</div><div className={styles.courtType}>Glass-backed</div></div><div className={styles.courtPrice}>$32/hr</div></div>
                <div className={styles.psCourtRow}><div><div className={styles.courtName}>Court 2</div><div className={styles.courtType}>Panoramic</div></div><div className={styles.courtPrice}>$34/hr</div></div>
                <div className={styles.psCourtRow}><div><div className={styles.courtName}>Court 3</div><div className={styles.courtType}>Glass-backed</div></div><div className={styles.courtPrice}>$32/hr</div></div>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.showcase} id="everything">
          <div className={styles.phones2}>
            <div className={`${styles.phone} ${styles.phoneC}`}>
              <div className={styles.phoneScreen}>
                <div className={styles.msHead}><span className={`${styles.msTab} ${styles.msTabOn}`}>Upcoming</span><span className={styles.msTab}>Past</span></div>
                <div className={styles.msList}>
                  <div className={styles.msRow}><span className={styles.bookingDate}>SAT<br />24</span><span className={styles.bookingCourt}>Court 1 · Takapuna</span><span className={styles.bookingAmount}>$32</span></div>
                  <div className={styles.msRow}><span className={styles.bookingDate}>WED<br />28</span><span className={styles.bookingCourt}>Court 3 · Albany</span><span className={styles.bookingAmount}>$32</span></div>
                  <div className={styles.msRow}><span className={styles.bookingDate}>FRI<br />4</span><span className={styles.bookingCourt}>Court 2 · Takapuna</span><span className={styles.bookingAmount}>$34</span></div>
                </div>
              </div>
            </div>
            <div className={`${styles.phone} ${styles.phoneD}`}>
              <div className={styles.phoneScreen}>
                <div className={styles.mstatPad}>
                  <div className={styles.statRound}>Round 4 · Match stats</div>
                  <div className={styles.mstatScore}>6<span className={styles.scoreSep}>–</span>3</div>
                  <div className={styles.statWon}>You won 🏆</div>
                  <div className={styles.mstatSets}>
                    <span className={styles.mstatSet}>Set 1 · 6–3</span>
                    <span className={styles.mstatSet}>Set 2 · 6–4</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div>
            <h2>Everything you need to play more padel</h2>
            <div className={styles.checklist}>
              <div className={styles.checkItem}>
                <div className={styles.checkMark}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg></div>
                <div><b>My Bookings, sorted for you</b><span>Upcoming and past games, one tap to reschedule or cancel</span></div>
              </div>
              <div className={styles.checkItem}>
                <div className={styles.checkMark}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg></div>
                <div><b>Match stats that stick around</b><span>Every set you record builds your win rate and ranking</span></div>
              </div>
              <div className={styles.checkItem}>
                <div className={styles.checkMark}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg></div>
                <div><b>Tournaments, run properly</b><span>Americano and Mexicano formats with live scoring and leaderboards</span></div>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.community}>
          <div className={styles.communityHead}>
            <h2>Discover. Connect. Play.</h2>
            <p>Find open games, meet new players, and see what&apos;s on at your club.</p>
          </div>
          <div className={styles.commGrid}>
            <div className={styles.commCard}>
              <div className={styles.cardTag}>Local events</div>
              <div className={styles.cardTitle}>Sunday Americano</div>
              <div className={styles.cardDesc}>Americano and Mexicano days, run properly</div>
              <div className={styles.commThumb} />
            </div>
            <div className={styles.commCard}>
              <div className={styles.cardTag}>Find players</div>
              <div className={styles.cardTitle}>Open games near you</div>
              <div className={styles.cardDesc}>Find a fourth, or join a game that fits your level</div>
              <div className={`${styles.commThumb} ${styles.thumbCoral}`} />
            </div>
            <div className={styles.commCard}>
              <div className={styles.cardTag}>Top clubs</div>
              <div className={styles.cardTitle}>Clubs near you, even when you travel</div>
              <div className={styles.cardDesc}>Across New Zealand, Australia and South Africa</div>
              <div className={`${styles.commThumb} ${styles.thumbTeal}`} />
            </div>
          </div>
        </section>

        <div className={styles.trust}>
          <div className={styles.trustItem}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/></svg> Clubs in New Zealand, Australia and South Africa</div>
          <div className={styles.trustItem}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V8a5 5 0 0110 0v3"/></svg> Secure, encrypted payments</div>
          <div className={styles.trustItem}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg> Live chat support</div>
        </div>

        <footer data-testid="landing-legal" style={{ marginTop: 28, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,0.18)', display: 'flex', flexWrap: 'wrap', gap: '8px 20px', fontSize: 13, fontWeight: 600, opacity: 0.9 }}>
          {LEGAL_LINKS.map(l => <Link key={l.href} href={l.href}>{l.label}</Link>)}
          <span style={{ opacity: 0.75, fontWeight: 500 }}>© {BUSINESS.legalName}</span>
        </footer>
      </div>
    </div>
  )
}
