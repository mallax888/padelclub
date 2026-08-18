import Link from 'next/link'
import { Manrope } from 'next/font/google'
import styles from './Landing.module.css'

const manrope = Manrope({ subsets: ['latin'], weight: ['500', '700', '800'] })

export default function Landing() {
  return (
    <div className={`${styles.field} ${manrope.className}`}>
      <nav className={styles.nav}>
        <div className={styles.brand}>
          <div className={styles.brandmark}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C7 2 3 6 3 11c0 6 5 9 9 11 4-2 9-5 9-11 0-5-4-9-9-9zm0 4a5 5 0 110 10 5 5 0 010-10z"/></svg>
          </div>
          <div className={styles.brandword}>PadelClub</div>
        </div>
        <div className={styles.navActions}>
          <Link href="/auth/login" className={`${styles.btn} ${styles.btnGhost}`}>Sign in</Link>
          <Link href="/auth/signup" className={`${styles.btn} ${styles.btnLime}`}>Get started</Link>
        </div>
      </nav>

      <div className={styles.wrap}>
        <section className={styles.hero}>
          <div>
            <div className={styles.eyebrow}><span className={styles.dot} /> New Zealand&apos;s home for padel</div>
            <h1 className={styles.heroTitle}>Book more.<br /><span className={styles.accent}>Wait less.</span></h1>
            <p className={styles.heroSub}>Find a court, split the bill, and track every match — all in one app built for Kiwi padel clubs.</p>
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
              <div className={styles.cardDesc}>Pacific Padel Takapuna · 12 players</div>
              <div className={styles.commThumb} />
            </div>
            <div className={styles.commCard}>
              <div className={styles.cardTag}>Find players</div>
              <div className={styles.cardTitle}>Open games near you</div>
              <div className={styles.cardDesc}>4 games looking for a fourth this week</div>
              <div className={`${styles.commThumb} ${styles.thumbCoral}`} />
            </div>
            <div className={styles.commCard}>
              <div className={styles.cardTag}>Top clubs</div>
              <div className={styles.cardTitle}>Pacific Padel Albany</div>
              <div className={styles.cardDesc}>4 courts · rated 4.9 by members</div>
              <div className={`${styles.commThumb} ${styles.thumbTeal}`} />
            </div>
          </div>
        </section>

        <div className={styles.trust}>
          <div className={styles.trustItem}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/></svg> Trusted by players across NZ</div>
          <div className={styles.trustItem}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V8a5 5 0 0110 0v3"/></svg> Secure, encrypted payments</div>
          <div className={styles.trustItem}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg> 24/7 support</div>
        </div>
      </div>
    </div>
  )
}
