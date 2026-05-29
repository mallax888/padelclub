# PadelClub — Booking App

Full-stack court booking app built with **Next.js 14**, **Supabase**, and **Tailwind CSS**.
Supports court bookings, membership tiers, session credit packs, and a staff admin panel.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) |
| Auth | Supabase Auth (email/password) |
| Database | Supabase (PostgreSQL + Row Level Security) |
| Styling | Tailwind CSS |
| Hosting | Vercel (free tier) |
| Payments | Stripe (coming next) |

---

## Setup — step by step

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New project
2. Choose a name (e.g. `padelclub`), set a strong database password, select **Sydney** region (closest to NZ)
3. Wait ~2 minutes for it to spin up

### 2. Run the database migration

1. In your Supabase dashboard → **SQL Editor** → **New query**
2. Open `supabase/migrations/001_initial_schema.sql` from this project
3. Paste the entire file contents into the editor
4. Click **Run**

This creates all tables, Row Level Security policies, and seeds your 4 courts.

### 3. Configure Supabase Auth

In your Supabase dashboard → **Authentication** → **URL Configuration**:
- **Site URL**: `http://localhost:3000` (update to your Vercel URL after deploy)
- **Redirect URLs**: Add `http://localhost:3000/auth/callback`

### 4. Set environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local` with values from **Supabase Dashboard → Settings → API**:
- `NEXT_PUBLIC_SUPABASE_URL` — your project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — your anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` — your service_role key (keep secret)
- `NEXT_PUBLIC_APP_URL` — `http://localhost:3000`

### 5. Install dependencies and run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6. Create your first admin account

1. Sign up through the app (`/auth/signup`)
2. Go to Supabase → **Table Editor** → `profiles`
3. Find your row and change `role` from `member` to `admin`
4. Refresh the app — you'll see the Admin tab in the nav

---

## Deploy to Vercel

1. Push this project to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → Import project → select your repo
3. Add your environment variables in the Vercel dashboard (same as `.env.local`)
4. Deploy — Vercel auto-detects Next.js

After deploy, update your Supabase Auth URLs to your Vercel domain.

---

## Project structure

```
padelclub/
├── app/
│   ├── (app)/                  # Auth-protected routes
│   │   ├── layout.tsx          # Shared layout with Navbar + auth guard
│   │   ├── book/               # Court booking flow
│   │   ├── mybookings/         # User's booking history
│   │   ├── membership/         # Plans + credit packs
│   │   └── admin/              # Staff-only dashboard
│   ├── auth/
│   │   ├── login/
│   │   ├── signup/
│   │   └── callback/           # Supabase OAuth callback
│   ├── layout.tsx              # Root layout + AuthProvider
│   └── globals.css
├── components/
│   ├── ui/                     # Shared: AuthProvider, Navbar
│   ├── booking/                # BookingFlow, MyBookingsList
│   ├── membership/             # MembershipPanel
│   └── admin/                  # AdminDashboard
├── lib/
│   ├── supabase-browser.ts     # Client-side Supabase client
│   ├── supabase-server.ts      # Server-side Supabase client
│   └── utils.ts                # Formatting, date helpers
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
├── types/
│   └── database.ts             # TypeScript types + MEMBERSHIP_CONFIG
└── .env.example
```

---

## Membership tiers (NZD)

| Tier | Price | Discount | Booking window | Monthly allowance |
|---|---|---|---|---|
| Casual | Free | 0% | 3 days | — |
| Club | $49/month | 15% | 5 days | $50 |
| Pro | $99/month | 25% | 7 days | $120 |

---

## Courts (default seed data)

| Court | Type | Indoor | Price |
|---|---|---|---|
| Court 1 | Glass-backed | Yes | $35/hr |
| Court 2 | Glass-backed | Yes | $35/hr |
| Court 3 | Open-sided | No | $25/hr |
| Court 4 | Open-sided | No | $25/hr |

Modify courts in **Supabase → Table Editor → courts**.

---

## Coming next (Phase 2)

- Stripe payments for memberships and credit pack purchases
- Automated email confirmations (Supabase + Resend)
- Recurring membership billing with webhooks
- Multi-sport support (tennis, squash, etc.)
- Online waiver / T&C acceptance at signup
- Member-facing invoice downloads
