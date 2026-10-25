# Elite Travel Hub

Website, booking system and admin dashboard for **Elite Travel Hub**, the tourist bus and travel car service in Thiruvrambu, Kerala.

| | |
|---|---|
| Frontend | React 19 + TypeScript, Vite, Tailwind CSS v4, Motion, React Router, react-hook-form + zod (`client/`) |
| Backend | Node.js + Express 5 + TypeScript, zod validation, Argon2id, Helmet, rate limiting (`server/`) |
| Database | Supabase Postgres (any Postgres 15+ works), SQL migrations in `supabase/migrations/` |
| Photo storage | Supabase Storage when configured, otherwise the server disk |

## What it does

**Public website:** home, fleet catalogue (filter by type, search, group size), vehicle detail pages (gallery, availability calendar, prefilled booking form), services, contact form, booking request form, booking status lookup, booking terms and privacy pages. Built mobile-first, with a sticky Call / WhatsApp / Book bar on phones.

**Booking workflow**
1. A customer sends a request. It is validated in the browser and again on the server.
2. If a specific vehicle was chosen, its confirmed trips and blocked dates are checked.
3. The request is saved as **Pending** with a reference like `ETH-2610-AB2CD`. The customer sees that reference straight away, and a pending request is never described as confirmed.
4. An administrator can confirm, reject, cancel, complete or reopen the booking. Every change is recorded in the booking history.
5. The customer checks the status at `/booking/status` using the reference and their mobile number.
6. Double booking is prevented in two places:
   - the server locks the vehicle row while confirming;
   - a Postgres exclusion constraint (`bookings_no_overlap`) makes it impossible for one vehicle to hold two confirmed trips on overlapping dates, even if two admins click Confirm at the same moment.

**Admin (`/admin`)**
- Overview with live counts, upcoming trips and recent activity.
- Bookings: search, filters, edit, status changes with confirmation dialogs, internal notes, history, and Call / WhatsApp / Email links.
- Vehicles: create/edit, photo upload, reordering and alt text, pricing, unavailable dates, enable/disable.
- Enquiries, site content (contact details, homepage copy, "why choose us", experiences, SEO, terms/privacy), services, testimonials (genuine only, hidden until published), and password change.

There is deliberately **no admin sign-up**. Administrators are created on the server (see below).

---

## Local development

Requirements: Node.js ≥ 20.19 (developed on 24), npm, and either Docker (for the local Supabase stack) or a Supabase cloud project.

```bash
npm install
cp .env.example .env
```

### Option A — local Supabase (Docker)

```bash
npx supabase start -x gotrue,realtime,studio,edge-runtime,logflare,vector,supavisor,imgproxy,mailpit,postgres-meta
```

This starts Postgres on `127.0.0.1:54322` and applies the migrations automatically. Keep `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres` and `DATABASE_SSL=false` in `.env`. Leave `SUPABASE_URL` empty to store photos on disk. To test Supabase Storage locally, set `SUPABASE_URL=http://127.0.0.1:54321` and a service-role key signed with the local JWT secret.

### Option B — Supabase cloud

1. Create a project at supabase.com.
2. Copy the connection string from **Project Settings → Database** into `DATABASE_URL` and set `DATABASE_SSL=true`.
3. For photo storage, set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (**Project Settings → API**). The `vehicle-images` public bucket is created automatically on the first upload.
4. Apply the schema: `npm run db:migrate`, or `npx supabase link` followed by `npx supabase db push`. Both record applied versions in the same table, so you can use either.

### Then

```bash
npm run db:seed                                   # fleet + services from the business's photos (safe to re-run)
npm run admin:create -- --email you@example.com --name "Your Name"   # prompts for a password (min 12 chars)
npm run dev                                       # API on :4000, website on http://localhost:5173
```

The admin dashboard is at <http://localhost:5173/admin>.

`npm run admin:create` with an existing email resets that administrator's password and signs out all of their sessions.

### Useful scripts

| Command | What it does |
|---|---|
| `npm run dev` | API (tsx watch) + Vite dev server with `/api` proxy |
| `npm run build` | Production build of client (`client/dist`) and server (`server/dist`) |
| `npm start` | Run the built server, which also serves the built website |
| `npm run typecheck` / `npm run lint` | TypeScript (both apps) / oxlint (client) |
| `npm test` | Server integration tests (vitest + supertest, real Postgres) |
| `npm run test:e2e` | Browser tests (Playwright) against a running app |
| `npm run db:migrate` / `npm run db:seed` | Apply migrations / seed fleet and services |
| `npm run images:process` | Rebuild the responsive image set from the original photos (see `docs/ASSETS.md`) |

## Testing

**Server integration tests:** `npm test`. They create and migrate a separate database called `elite_test` on the server in `TEST_DATABASE_URL`, which defaults to the local Supabase Postgres. The suite refuses to run against any database whose name doesn't contain `test`. Coverage:
- Booking validation, references, duplicate submissions, seat limits and indicative fares.
- Confirm/reject/cancel/complete transitions and the history log.
- Overlap prevention, including two interleaved transactions hitting the database constraint.
- Blocked dates, and status lookup that gives the same response whether the reference or the phone is wrong.
- Admin auth: Argon2 hashes, httpOnly SameSite=Strict cookie, logout, 401 on every admin route, CSRF header.
- Vehicle CRUD, image upload validation, settings validation, testimonials, enquiries, and no customer data on public endpoints.

**Browser tests** (Playwright, run against `npm run dev` or a production server):

```bash
E2E_ADMIN_EMAIL=you@example.com E2E_ADMIN_PASSWORD='…' npm run test:e2e
# E2E_BASE_URL=http://localhost:4000 to test a production build
```

They cover:
- the homepage and its contact links;
- catalogue filtering;
- client-side validation;
- the full lifecycle: book on a phone-sized screen, confirm in the admin, check status as the customer, see the vehicle shown as booked, then cancel and sign out.

They create real bookings, so use a development database.

## Production deployment

The built server is a single Node process that serves the API, the website and uploaded photos.

```bash
npm ci
npm run build
NODE_ENV=production npm run db:migrate      # or: npx supabase db push
npm run db:seed                              # first deploy only
npm run admin:create -- --email owner@example.com --name "Owner"
NODE_ENV=production npm start
```

Production `.env` checklist:
- `NODE_ENV=production` (makes the session cookie `Secure`; serve over HTTPS).
- `PUBLIC_SITE_URL=https://your-domain` (used for canonical links, the sitemap and email links).
- `DATABASE_URL` from Supabase, plus `DATABASE_SSL=true`.
- `TRUST_PROXY=1` when running behind Nginx or a platform load balancer (needed for correct rate limiting).
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for photo storage. Without them, set `UPLOAD_DIR` to a persistent directory and back it up.
- SMTP settings if you want email notifications.

Run it under a process manager (systemd, PM2, or a platform such as Render, Railway or Fly.io) and put it behind HTTPS. Example Nginx block:

```nginx
server {
  server_name elitetravelhub.example;
  client_max_body_size 50m;            # photo uploads (10 × 8 MB max)
  gzip on; gzip_types text/css application/javascript application/json image/svg+xml;
  location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

The rate limiter keeps its counts in memory. If you run more than one instance, configure a shared store (see the express-rate-limit docs).

## Security notes

- Passwords are hashed with Argon2id. Sessions are random tokens stored only as SHA-256 hashes, sent in an `httpOnly`, `SameSite=Strict` cookie (also `Secure` in production) and expiring after `SESSION_TTL_HOURS`. Changing a password signs out the other sessions.
- Every `/api/admin/*` route requires a valid session. Every state-changing API request must carry the `X-ETH-Request` header (CSRF defence).
- Rate limits apply to login (per IP + email), booking requests, status lookups and the contact form. Forms also include a honeypot field.
- All input is validated on the server with zod. Uploaded images are decoded and re-encoded by sharp, which rejects files that aren't real images and strips metadata such as GPS. Uploads are limited by type, size and dimensions.
- Helmet sets a strict Content-Security-Policy and other security headers.
- **Supabase:** every table has Row Level Security enabled, and privileges are revoked from the `anon` and `authenticated` roles, so the Supabase REST API cannot read bookings or admin data even with the public anon key. All access goes through the Node server.
  - Supabase grants default privileges on newly created tables, so **repeat the RLS-and-revoke block in any future migration that adds a table**.
- Public endpoints never return customer contact details. Status lookup needs both the reference and the matching mobile number.

## Configuration still needed from the business

- **Seating capacity, amenities, specifications and prices** for each vehicle. These are blank on purpose (the website shows "Seating on request" and hides prices until they are set). Admin → Vehicles.
- The **Traveller — awaiting photos** vehicle is disabled because it only appears in the group photo. Add its own photos and details, then enable it.
- **Street address, opening hours, Google Maps link/embed and social links** (Admin → Site content → Contact). The map only appears once a verified embed link is added.
- **Testimonials:** add only genuine reviews. Until one is published, the homepage shows a fleet photograph instead.
- **SMTP credentials** if email notifications are wanted. Without them no emails are sent, and the dashboard says so.
- WhatsApp opens a chat with a prefilled message (wa.me links). Automated WhatsApp messages would need the WhatsApp Business API, which is not integrated.
- Review the default booking terms and privacy policy text.

## Project structure

```
client/                 React app
  src/pages/            public pages
  src/components/       site + UI components (BookingForm, VehicleCard, Layout …)
  src/admin/            admin dashboard (lazy-loaded bundle)
  src/data/photos.json  generated responsive-image manifest
  public/images/        generated WebP photos and cutouts
  e2e/                  Playwright tests
server/
  src/routes/           public + admin API
  src/services/         bookings, vehicles, settings
  src/lib/              auth, storage, email, SEO head rendering, validation helpers
  src/scripts/          migrate, seed, create-admin
  src/test/             integration tests
supabase/migrations/    database schema
scripts/                image pipeline (process-images.mjs, cutouts.py)
assets/cutouts/         reviewed background-removed vehicle masters
docs/ASSETS.md          photo inventory and processing notes
```
