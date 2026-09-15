# PadelClub

Court booking platform for padel clubs. Next.js 14 (App Router) + Supabase
(Postgres, Auth, RLS) + Stripe, deployed to Vercel as `padelclub-nz`.

See `README.md` for setup. This file is about how to work on the code.

## The bar for any change

**Super user friendly and modern.** That is the standard the owner holds every
change to, not a nice-to-have. In practice:

- Clear at a glance. If someone has to study a screen to work out what it is
  telling them, it isn't finished.
- Nothing fiddly. No tiny tap targets, no controls that only work on hover, no
  three-step flow where one step would do.
- Nothing that looks like a 2010 admin panel. Generous spacing, real type
  hierarchy, calm colour.

## Working rules

**Never invent data.** No placeholder bookings, no sample players, no badges or
counts backed by nothing. If a feature needs data the database doesn't have
yet, say so and build the thing that fetches it — don't fake it to make a
screenshot look full. This applies especially to anything the owner might show
a prospective client.

**Show mockups before building anything visual.** For a layout, colour or
component change, render a static HTML mockup, screenshot it, and get a pick
before writing app code. Cheaper than building the wrong thing twice.

**Controls must not resize or move as their content changes.** A date label
that grows from "Tue, 6 Oct" to "Mon, 14 Sept – Sun, 20 Sept" must not shove
the arrow beside it; day pills must be one fixed width whatever the date. Give
these a fixed width sized to the longest string they can hold. This has been
fixed more than once — don't reintroduce it.

**All dates go through the helpers in `lib/utils.ts`.** `formatDate`
("Tue, 22 Sept") for anything happening soon, `formatDateCompact` ("Tue 22")
for a run of consecutive days, `formatDateWithYear` ("22 Sept 2026") for
history. Never hand-roll a date string, and never
`new Date().toISOString().slice(0, 10)` for "today" — that returns yesterday
for half of every day in NZ/AU. Use `localDateStr()`.

## Theming

Colours live as CSS custom properties in `app/globals.css` and come in a light
and a dark set — the brand accent is cyan on light, lime on dark. **Never
hardcode a hex value in a component.** Use the tokens:

`--bg-surface`, `--bg-raised`, `--border`, `--text-primary`, `--text-muted`,
`--text-subtle`, `--brand-primary`, `--brand-primary-on` (text *on* the
accent), `--brand-primary-text` (accent-coloured text on a normal ground),
`--brand-primary-muted`, `--brand-crimson`, `--shadow-float`.

A change that only looks right in dark mode isn't done.

## Layout of the code

- `app/(app)/` — the signed-in app: `admin`, `book`, `find-a-game`, `ladders`,
  `membership`, `mybookings`, `players`, `record-match`, `tournaments`
- `app/api/` — route handlers
- `components/admin/` — the staff dashboard. `AdminDashboard.tsx` holds the
  board (Day / Week / Month schedule) and is the file most changes touch.
- `lib/` — shared logic. `venues.ts`, `pricing.ts`, `booking-price.ts`,
  `currency.ts`, `supabase-{browser,server,admin}.ts`
- `supabase/migrations/` — numbered SQL migrations
- `types/database.ts` — generated (`npm run db:types`); it lags new migrations,
  so a just-added column may need a local cast until it's regenerated

**Venues are hardcoded in `lib/venues.ts`**, not database rows. Onboarding a
new club is a code deploy, not an admin action.

## Admin API routes and RLS

Admin routes use the **caller's own** `createServerClient()`, not the
service-role client, so the existing venue/country policies
(`017_country_scoped_staff.sql`) scope the data automatically. Reaching for
service-role in an admin route silently removes that scoping — don't, unless
the route genuinely needs to act as the system, and say so in a comment when
it does.

## Migrations

A migration must be run in Supabase by the owner before code depending on it
ships. So:

- Write the query so it degrades gracefully if the new columns aren't there
  yet (see `loadReplacedNames()` in
  `app/api/admin/booking-roster/route.ts`), **or**
- Flag the dependency clearly, hand over the raw SQL, and wait for
  confirmation before merging.

Never merge code that breaks a live page the moment it deploys against the
old schema.

## Before pushing

Run `npm run build`. It typechecks, and a type error is the usual way a change
breaks the Vercel deploy.

## Root-level `fix-*.js` / `patch-*.js`

One-shot codemods from earlier work, kept only as history. They are not part
of the app, are not run by anything, and should not be extended — edit the
source files directly.
