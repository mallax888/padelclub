const fs = require('fs');
const path = 'components/booking/MyBookingsList.tsx';
const c = fs.readFileSync(path, 'utf8');

const startMarker = "const venue = VENUES.find(v => v.slug === (b.courts as any)?.venue_slug)\n\n  return (";
const idx = c.indexOf(startMarker);
const returnStart = idx + startMarker.length - "return (".length;
const end = c.lastIndexOf("  )\n}") + "  )\n}".length;

if (idx === -1 || end === -1) {
  console.log('Boundaries not found. idx:', idx, 'end:', end);
  process.exit(1);
}

const newJSX = `return (
    <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-12 h-12 rounded-lg flex items-center justify-center text-xl shrink-0" style={{ background: 'var(--brand-primary-muted)' }}>
            🎾
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
              {b.courts?.name} — {b.courts?.type}
            </div>
            {venue && (
              <div className="text-sm font-medium mt-0.5 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                {venue.name}
              </div>
            )}
            <div className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {formatDate(b.date)} · {b.start_time.slice(0,5)}–{b.end_time.slice(0,5)} · {durationLabel(b.duration_minutes)}
            </div>
            {!past && venue && (
              
                href={\`https://www.google.com/maps/search/?api=1&query=\${encodeURIComponent(venue.address)}\`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold mt-1.5"
                style={{ color: 'var(--brand-primary)' }}
                onClick={e => e.stopPropagation()}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>
                Take me to the court
              </a>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className={cn('badge', 'status-' + b.status)} style={{ fontWeight: 700, padding: '4px 12px' }}>{b.status}</span>
          <div className="text-2xl font-bold mt-2" style={{ color: 'var(--brand-primary)' }}>{formatNzd(b.price_nzd)}</div>
          <div className="text-xs font-medium mt-0.5" style={{ color: payment.color }}>{payment.label}</div>
        </div>
      </div>
      {splits.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
          <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>Split with:</span>
          {splits.map(s => {
          const name = s.profiles?.nickname ?? s.profiles?.full_name ?? 'Player'
          const paid = s.status === 'paid'
          return (
            <span key={s.id} className="text-xs font-medium px-2 py-0.5 rounded-full" style={{
              background: paid ? 'var(--brand-primary-muted)' : 'rgba(220,50,50,0.1)',
              color: paid ? 'var(--brand-primary)' : '#DC3232',
              border: paid ? '1px solid var(--brand-primary)' : '1px solid #DC3232',
            }}>
              {name} {paid ? '✓' : '⏳'}
            </span>
          )
        })}
        </div>
      )}
      <div className="flex items-center justify-end pt-2" style={{ borderTop: splits.length > 0 ? 'none' : '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          {b.stripe_payment_id && (
            <a href={'https://dashboard.stripe.com/test/payments/' + b.stripe_payment_id} target="_blank" rel="noopener noreferrer"
              className="text-xs px-2 py-1 rounded-lg" style={{ background: 'var(--bg-raised)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              Receipt ↗
            </a>
          )}
          {canCancel && (
            <div className="flex flex-col items-center gap-1">
              <button className="btn btn-danger btn-sm" onClick={onCancel} disabled={cancelling}>
                {cancelling ? '…' : 'Cancel'}
              </button>
              <span className="text-xs text-center" style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{!isPaid ? 'No charge' : isLateCancel ? '50% credit' : 'Full refund'}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}`;

const finalContent = c.slice(0, returnStart) + newJSX + c.slice(end);
fs.writeFileSync(path, finalContent, 'utf8');
console.log('Boundaries found:', idx !== -1 && end !== -1);
console.log('Price moved to right column:', finalContent.includes("text-2xl font-bold mt-2\" style={{ color: 'var(--brand-primary)' }}>{formatNzd(b.price_nzd)}"));
console.log('New button copy present:', finalContent.includes('Take me to the court'));
console.log('Old bottom price row removed:', !finalContent.includes('font-medium\" style={{ color: payment.color }}>{payment.label}</span>\\n          <span className="text-sm font-bold"'));
