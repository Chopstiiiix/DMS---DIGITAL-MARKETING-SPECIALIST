# DMS — Digital Marketing Specialist

One platform that plans, drafts, schedules, tracks and reports marketing for
several brands. Spin Music is the first brand.

**Status: Phase 1 (core + tracking), in progress.** What exists today:

- Sign-in by one-time email link or password (no public sign-up; sign-in never
  creates accounts) and a per-brand workspace
- Link builder: one short tracked link per post, message or partner
- Public redirect that logs each click and passes campaign tags to the destination
- Dashboard: clicks, signups and activations by channel and campaign
- Multi-tenant database schema with row level security

Not built yet: product sync (signups/activations), content engine, outreach,
weekly review, paid ads.

## How tracking works

1. A link is created for a brand, e.g. `https://go.spinmusic.uk/kenya`.
2. A click hits `app/r/[...parts]/route.ts`. It looks the link up, stores a
   click row (country, device, referrer host, bot flag, salted visitor hash;
   never the IP address), and answers with a `302`.
3. The destination URL gets `utm_source`, `utm_medium=dms`, `utm_campaign`,
   `utm_content` and `dms_click=<click id>`. App Store URLs get Apple's
   `ct` / `pt` / `mt` instead.
4. The product stores `dms_click` at signup. The sync job turns signups and
   activations into `funnel_events` joined to that click.

A link may only point at hosts on its brand's allow-list
(`brands.allowed_hosts`), so the redirector cannot be used as an open redirect.

## Hosts

One deployment serves the app and every brand's link domain. `proxy.ts`
decides which is which: `localhost`, `*.vercel.app` and anything in
`APP_HOSTS` is the app; every other host is a link domain where each path is
a short link.

## Database

DMS shares the `mot-platform` Supabase project (eu-west-1) with other apps to
avoid paying for a separate one. To stay out of their way it keeps everything
in two schemas of its own:

- `dms` — tables and the `link_stats` function. Listed under
  **Integrations → Data API → Settings → Exposed schemas** in the Supabase
  dashboard (done 2026-10-05).
- `dms_private` — helper functions used by row level security. Not exposed.

Access is granted explicitly in the migration: signed-out clients get nothing,
signed-in users get what row level security allows, and only the service role
writes clicks, funnel events and the audit log.

Rules for every new table in `dms`:

1. Enable row level security and add policies in the same migration.
2. Grant access explicitly (`authenticated` for what the app reads or edits,
   `service_role` for server jobs). Nothing is granted automatically: the
   dashboard's "Automatically expose new tables" setting covers the `public`
   schema only.
3. Never grant to `anon`.

The dashboard's "Exposed tables" list may show the `dms` tables as off. Leave
them off. Switching one on there adds grants beyond the ones the migration
chose; signed-in access already works through the explicit grants.

Sharing a project means sharing its sign-in. Accounts created by the other
apps can authenticate against DMS, but they belong to no DMS organization, so
they see an empty workspace and cannot read or write anything. When DMS needs
its own project, `pg_dump -n dms -n dms_private` moves it.

## Setup

1. Copy `.env.example` to `.env.local` and fill it in.
2. The schema (`supabase/migrations/`) and first brand (`supabase/seed.sql`)
   are already applied to `mot-platform`. For a fresh project, apply both and
   add `dms` to the exposed schemas.
3. Add a `dms.memberships` row for each person who should have access
   (see the comment in `seed.sql`).
4. In Supabase, add the app's address to **Authentication → URL
   Configuration → Redirect URLs** (e.g. `https://<app host>/auth/callback`),
   or emailed sign-in links will not return to DMS.
5. `npm install`, then `npm run dev`.

## Checks

| Command | What it does |
| --- | --- |
| `npm test` | Unit tests, including the redirect route against a fake database |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
| `npm run build` | Production build |
| `./scripts/test-db.sh` | Applies the migrations to a scratch local Postgres and runs the tenant isolation tests in `supabase/tests/` |

## Layout

```
app/(app)/            signed-in pages: dashboard, links
app/login/            sign-in
app/auth/callback/    landing point for emailed sign-in links
app/r/[...parts]/     public short-link redirect
lib/links/            slug, destination, classification and form rules (pure, tested)
lib/supabase/         server client (as the user) and admin client (service role)
lib/hosts.ts          app host vs link domain
proxy.ts              session refresh, auth guard, link-domain rewrite
supabase/migrations/  schema and row level security
supabase/tests/       tenant isolation tests
```
