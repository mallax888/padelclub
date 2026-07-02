const fs = require('fs');
let c = fs.readFileSync('components/membership/MembershipPanel.tsx', 'utf8');

const target = `            </table>
          </div>
        </div>
      )}
    </div>
  )
}`;

const replacement = `            </table>
          </div>
        </div>
      )}

      {/* Booking prompt after upgrade */}
      {showBookingPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={e => e.target === e.currentTarget && setShowBookingPrompt(null)}>
          <div className="rounded-2xl p-6 w-full max-w-sm text-center"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--brand-primary)', boxShadow: 'var(--glow-primary)' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🎾</div>
            <div className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
              Welcome to {showBookingPrompt}!
            </div>
            <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
              Your new perks are active now. Ready to put them to use?
            </p>
            <button
              className="w-full py-3 rounded-xl text-sm font-bold transition-all mb-2"
              style={{ background: 'var(--brand-primary)', color: 'var(--brand-primary-on)', boxShadow: 'var(--glow-primary)' }}
              onClick={() => router.push('/book')}
            >
              New booking →
            </button>
            <button
              className="w-full py-2 text-xs font-medium"
              style={{ color: 'var(--text-muted)' }}
              onClick={() => setShowBookingPrompt(null)}
            >
              Maybe later
            </button>
          </div>
        </div>
      )}
    </div>
  )
}`;

c = c.replace(target, replacement);
fs.writeFileSync('components/membership/MembershipPanel.tsx', c, 'utf8');
console.log('Modal JSX added:', c.includes('New booking →'));
