const fs = require('fs');

// Update page to also fetch outgoing splits
let page = fs.readFileSync('app/(app)/mybookings/page.tsx', 'utf8');
page = page.replace(
  `    supabase
      .from('booking_splits')
      .select('*, bookings(date, start_time, end_time, courts(name, type)), profiles!booking_splits_invited_by_fkey(nickname, full_name)')
      .eq('user_id', session!.user.id)
      .eq('status', 'pending'),`,
  `    supabase
      .from('booking_splits')
      .select('*, bookings(date, start_time, end_time, courts(name, type)), profiles!booking_splits_invited_by_fkey(nickname, full_name)')
      .eq('user_id', session!.user.id)
      .eq('status', 'pending'),
    supabase
      .from('booking_splits')
      .select('*, profiles!booking_splits_user_id_fkey(nickname, full_name)')
      .eq('invited_by', session!.user.id),`
);

page = page.replace(
  `  const [{ data: bookings }, { data: profile }, { data: splitRequests }] = await Promise.all([`,
  `  const [{ data: bookings }, { data: profile }, { data: splitRequests }, { data: outgoingSplits }] = await Promise.all([`
);

page = page.replace(
  `      <MyBookingsList bookings={bookings ?? []} profile={profile!} splitRequests={splitRequests ?? []} />`,
  `      <MyBookingsList bookings={bookings ?? []} profile={profile!} splitRequests={splitRequests ?? []} outgoingSplits={outgoingSplits ?? []} />`
);

fs.writeFileSync('app/(app)/mybookings/page.tsx', page, 'utf8');

// Update component to show split status per booking
let c = fs.readFileSync('components/booking/MyBookingsList.tsx', 'utf8');

// Add OutgoingSplit type
c = c.replace(
  `interface SplitRequest {`,
  `interface OutgoingSplit {
  id: string
  booking_id: string
  amount_nzd: number
  status: string
  profiles: { nickname: string | null; full_name: string | null } | null
}

interface SplitRequest {`
);

// Add outgoingSplits prop
c = c.replace(
  `  splitRequests = [],
}: {
  bookings: BookingWithCourt[]
  profile: Profile
  splitRequests?: SplitRequest[]
})`,
  `  splitRequests = [],
  outgoingSplits = [],
}: {
  bookings: BookingWithCourt[]
  profile: Profile
  splitRequests?: SplitRequest[]
  outgoingSplits?: OutgoingSplit[]
})`
);

// Pass outgoingSplits to BookingRow
c = c.replace(
  `            {upcoming.map(b => (
              <BookingRow key={b.id} booking={b} onCancel={() => handleCancel(b.id)} cancelling={cancelling === b.id} />
            ))}`,
  `            {upcoming.map(b => (
              <BookingRow key={b.id} booking={b} onCancel={() => handleCancel(b.id)} cancelling={cancelling === b.id} splits={outgoingSplits.filter(s => s.booking_id === b.id)} />
            ))}`
);

c = c.replace(
  `            <div className="space-y-2 opacity-60">
              {past.map(b => <BookingRow key={b.id} booking={b} past />)}
            </div>`,
  `            <div className="space-y-2 opacity-60">
              {past.map(b => <BookingRow key={b.id} booking={b} past splits={outgoingSplits.filter(s => s.booking_id === b.id)} />)}
            </div>`
);

// Update BookingRow signature
c = c.replace(
  `function BookingRow({ booking: b, onCancel, cancelling, past }: { booking: BookingWithCourt; onCancel?: () => void; cancelling?: boolean; past?: boolean }) {`,
  `function BookingRow({ booking: b, onCancel, cancelling, past, splits = [] }: { booking: BookingWithCourt; onCancel?: () => void; cancelling?: boolean; past?: boolean; splits?: OutgoingSplit[] }) {`
);

// Add split status display inside BookingRow before closing div
c = c.replace(
  `      <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid var(--border)' }}>`,
  `      {splits.length > 0 && (
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
      <div className="flex items-center justify-between pt-2" style={{ borderTop: splits.length > 0 ? 'none' : '1px solid var(--border)' }}>`
);

fs.writeFileSync('components/booking/MyBookingsList.tsx', c, 'utf8');
console.log('Done');
