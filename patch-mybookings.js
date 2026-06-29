const fs = require('fs');

fs.writeFileSync('app/(app)/mybookings/page.tsx', `import { createServerClient } from '@/lib/supabase-server'
import MyBookingsList from '@/components/booking/MyBookingsList'
export default async function MyBookingsPage() {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  const [{ data: bookings }, { data: profile }, { data: splitRequests }] = await Promise.all([
    supabase
      .from('bookings')
      .select('*, courts(*)')
      .eq('user_id', session!.user.id)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true }),
    supabase.from('profiles').select('*').eq('id', session!.user.id).single(),
    supabase
      .from('booking_splits')
      .select('*, bookings(date, start_time, end_time, courts(name, type)), profiles!booking_splits_invited_by_fkey(nickname, full_name)')
      .eq('user_id', session!.user.id)
      .eq('status', 'pending'),
  ])
  return (
    <div>
      <div className="mb-6" style={{ userSelect: 'none' }}>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>My bookings</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Your upcoming and past court reservations</p>
      </div>
      <MyBookingsList bookings={bookings ?? []} profile={profile!} splitRequests={splitRequests ?? []} />
    </div>
  )
}`, 'utf8');

const c = fs.readFileSync('components/booking/MyBookingsList.tsx', 'utf8');

const newTypes = `interface SplitRequest {
  id: string
  booking_id: string
  amount_nzd: number
  status: string
  bookings: {
    date: string
    start_time: string
    end_time: string
    courts: { name: string; type: string } | null
  } | null
  profiles: { nickname: string | null; full_name: string | null } | null
}

`;

const newProps = c.replace(
  'export default function MyBookingsList({\n  bookings,\n  profile,\n}: {\n  bookings: BookingWithCourt[]\n  profile: Profile\n})',
  `export default function MyBookingsList({
  bookings,
  profile,
  splitRequests = [],
}: {
  bookings: BookingWithCourt[]
  profile: Profile
  splitRequests?: SplitRequest[]
})`
);

const withTypes = newProps.replace(
  "function paymentLabel",
  newTypes + "function paymentLabel"
);

const splitSection = `      {splitRequests.length > 0 && (
        <div className="rounded-xl p-4 mb-6" style={{ background: 'rgba(220,50,50,0.06)', border: '1px solid #DC3232' }}>
          <div className="text-sm font-semibold mb-3" style={{ color: '#DC3232' }}>Outstanding split requests</div>
          <div className="space-y-3">
            {splitRequests.map(s => {
              const who = s.profiles?.nickname ?? s.profiles?.full_name ?? 'Someone'
              const court = s.bookings?.courts?.name ?? 'a court'
              const date = s.bookings?.date ? formatDate(s.bookings.date) : ''
              const time = s.bookings?.start_time?.slice(0,5) ?? ''
              return (
                <div key={s.id} className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium" style={{ color: '#DC3232' }}>You owe {who} {formatNzd(s.amount_nzd)}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{court} · {date} · {time}</div>
                  </div>
                  <button
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg shrink-0"
                    style={{ background: '#DC3232', color: '#fff' }}
                    onClick={() => alert('Stripe payment coming soon!')}
                  >
                    Pay {formatNzd(s.amount_nzd)}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

`;

const withSplit = withTypes.replace(
  '      <div className="grid grid-cols-3 gap-3 mb-6">',
  splitSection + '      <div className="grid grid-cols-3 gap-3 mb-6">'
);

fs.writeFileSync('components/booking/MyBookingsList.tsx', withSplit, 'utf8');
console.log('Done');
