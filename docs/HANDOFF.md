# DMS handoff — 5 October 2026

Handed from a Claude Cowork session to Claude CLI. Claude CLI then pushed the
code, created the Vercel project and deployed to production (steps 1 to 4
below, done 5 October). **Live at https://dms-mu-black.vercel.app.**

## Where things stand

| Thing | State |
| --- | --- |
| Code | In `~/INSPIRE_EDGE/dms`, pushed to `main`. |
| GitHub | `https://github.com/Chopstiiiix/DMS---DIGITAL-MARKETING-SPECIALIST.git` (`origin`). |
| Database | Schema applied to Supabase project `mot-platform` (migration `dms_init`). First org and brand seeded. `dms` schema exposed through the Data API. |
| Vercel | Project `dms` (`prj_yxYfrEiQpIgsi8KJl8iwxBZ6Fzco`) in "Chopper's projects" (`team_Sv4x7CmXpc3UlyGxo9nMtIP0`, slug `choppers-projects-b98532fa`). Connected to GitHub: every push to `main` deploys to production. Env vars set. |
| Production | `https://dms-mu-black.vercel.app`. Redirect URL `https://dms-mu-black.vercel.app/auth/callback` added in Supabase. |
| Sign-in | Email link tested end to end on production. |
| Short-link domain | `https://go.spinmusic.uk/<slug>` live: added to the Vercel project, Let's Encrypt certificate issued, first real link `ig` clicked and logged. |
| Spin sync | Not started. Dashboard shows clicks only until it exists. |

## What was built (Phase 1, first slice)

- Sign-in page: email-only sends a one-time link; email + password also works. No public sign-up.
- Per-brand workspace; Spin Music is brand one.
- Link builder: short tracked link with channel, optional campaign and content pillar.
- Public redirect `app/r/[...parts]/route.ts`: logs the click, then 302s to the destination with `utm_*` and `dms_click=<click id>` (or Apple's `ct`/`pt`/`mt` for App Store URLs).
- Dashboard: clicks, signups and activations by channel and campaign, 7/30/90 days.
- Schema with per-organization isolation: `organizations, memberships, brands, campaigns, links, link_clicks, funnel_events, audit_events`, plus `dms.link_stats()`.

## What was verified, and what was not

Verified:

- 49 unit tests, type check, lint and production build pass.
- 36 tenant-isolation checks pass on a local Postgres 16 (`./scripts/test-db.sh`).
- 14 isolation checks passed on the real `mot-platform` database (Postgres 17) inside a rolled-back transaction.
- Supabase security advisor reports nothing for `dms` or `dms_private`.

Verified on production (5 October, Claude CLI):

- Emailed sign-in link, end to end.
- Creating a link through the Data API as the signed-in user (RLS applies). No grant changes were needed.
- The redirect: `302` to `spinmusic.uk/signup` with `utm_*` and `dms_click`, and a matching row in `dms.link_clicks` (country, device, OS, bot flag, salted hash, no IP).

Not verified yet:

- `./scripts/test-db.sh` was not re-run (Docker was off; no migration changed).

The click also showed on the dashboard (checked by Malcolm). The `smoke-test` link and its click were then deleted, so Spin starts with no links and no clicks.

## Identifiers

| Item | Value |
| --- | --- |
| Supabase project (DMS) | `mot-platform`, ref `amxkbtjibfgvykexvkus`, eu-west-1, org `Inspire Org` |
| Supabase URL | `https://amxkbtjibfgvykexvkus.supabase.co` |
| Publishable key | in `.env.example` (safe to expose) |
| Supabase project (Spin's own data) | `Radio1`, ref `feqtoilsffjxctgjsmme`, us-east-1 |
| DMS owner account | `send2chopstix@gmail.com` (email + password account in `mot-platform`; there is no Google sign-in in that project) |
| Seeded org / brand | `Inspire` / `Spin Music` (slug `spin`) |
| Brand settings | link domain `go.spinmusic.uk`; default destination `https://spinmusic.uk/signup`; allowed hosts `spinmusic.uk`, `apps.apple.com` |
| Vercel function region | `dub1` (set in `vercel.json`, next to the database) |
| Spin brand id | `543a3992-ed6e-4014-9ba5-0cac13034c20` |
| Short-link fallback | `https://dms-mu-black.vercel.app/r/543a3992-ed6e-4014-9ba5-0cac13034c20/<slug>` (works alongside the real domain) |
| Short-link DNS | Cloudflare zone `spinmusic.uk` (`e876bf9a988b2779cb81a44166ed6b5a`): `A go → 76.76.21.21`, DNS only (grey cloud), record `c1cb2da66bcf15ef3f49431fedf5aa84`. Keep it grey: Vercel issues the certificate and the redirect reads the visitor's real headers. Changed with the API token in `~/INSPIRE_EDGE/Automation/.env`. |
| Spin app repo | `~/INSPIRE_EDGE/radio1` (`github.com/Chopstiiiix/RADIO1`) |

## Environment variables for Vercel (all set)

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://amxkbtjibfgvykexvkus.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | copy from `.env.example` |
| `SUPABASE_SECRET_KEY` | Set by Malcolm (Production, Preview). From Supabase → mot-platform → Settings → API Keys. Never put it in chat or in git. |
| `LINK_HASH_SALT` | Set (Production, Preview, sensitive). Do not rotate it without accepting that same-day visitor counts reset. |
| `APP_HOSTS` | Leave empty until the app gets a custom domain. See the warning below. |

## Next steps, in order

Steps 1–5 were **done on 5 October**: git cleaned and pushed, Vercel project created and deployed, sign-in redirect URL added in Supabase, production smoke test passed (see "What was verified"), and `go.spinmusic.uk` set up and tested with a real link.

6. **Spin signup change: built, awaiting Malcolm's review.** Branch `feat/dms-signup-attribution` in `radio1` (pushed, not merged). Middleware keeps `dms_click` + `utm_*` in an `sm_dms` cookie (30 days, last click wins); `/api/attribution/claim`, fired on app load, writes one row per new account to `public.signup_attribution` (service role only), only when the account was created after the click. To ship: review, apply `supabase/migrations/20261005160000_signup_attribution.sql` to Radio1, merge. Known gap: an email-password signup confirmed in a different browser loses the cookie; Google/Apple and same-browser confirmation are fine.
7. **Spin read-only access: written, awaiting Malcolm's review.** Same branch, `radio1/supabase/migrations/20261005170000_dms_reporting.sql` (shown to Malcolm 5 October, not run). Schema `dms_reporting` (not exposed) with one view, `funnel_events`: one row per user and event (`signup`, `first_upload`, `first_broadcast` = first ended `broadcast_sessions` row of any length, `activation` = upload or broadcast within 7 days, `first_earning` = any `earnings` row) plus `is_spinner`, `country`, `dms_click_id`, `utm_*`. No names or emails. Role `dms_reader`: select on that view only, read-only transactions, 3 connections, 30 s timeout, no password in git. To ship, after step 6's migration: apply it, then in the Radio1 SQL editor `alter role dms_reader with password '<generated>'`. Dry run of the view's query on 5 October: 154 signups, 17 first broadcasts, 14 first uploads, 14 activations, 2 first earnings. `broadcast_sessions` only starts 2026-06-05, so 8 older first broadcasts (`broadcaster_profiles.has_broadcasted`) are missing. Open with Malcolm: minimum broadcast length, and whether pending earnings count.
8. **Sync job in DMS: built and deployed, waiting on steps 6 and 7.** `app/api/cron/sync-spin` (Vercel Cron, daily 05:00 UTC; Hobby-safe schedule) reads `dms_reporting.funnel_events` as `dms_reader` and upserts `dms.funnel_events` for brand `spin`. A click id counts only if it is one of Spin's recorded `dms.link_clicks`; UTM tags, country and `is_spinner` go into `metadata`. `CRON_SECRET` is set in Vercel. **To switch on:** after steps 6 and 7 are applied and `dms_reader` has a password, add `SPIN_DATABASE_URL` in Vercel (Production; Radio1 → Connect → transaction pooler URL, user `dms_reader.feqtoilsffjxctgjsmme`), redeploy, then trigger it once by hand (see README) and check the dashboard. Until then the daily run fails harmlessly with "Missing environment variable SPIN_DATABASE_URL". Rows for users deleted in Spin stay in DMS.
9. Then Phase 2 (content engine) per `docs/PLAN.md`. Cowork suggested moving the outreach module ahead of it, since Malcolm now owns every first-month channel himself. He has not answered.

## Things that will bite

- **`APP_HOSTS`.** `proxy.ts` treats `localhost`, `*.vercel.app` and anything in `APP_HOSTS` as the app. Every other host is treated as a brand's link domain, where each path is a short link. If the app is ever given a custom domain, add it to `APP_HOSTS` first or the dashboard will 404.
- **Shared Supabase project.** `mot-platform` also holds MotCheck, Confirmo and Level. Their accounts can authenticate against DMS but see nothing (tested). Any new auth user in that project automatically gets a Level profile through a trigger, which is one reason sign-in never creates accounts.
- **Sign-in email** uses Supabase's built-in sender unless custom SMTP is configured: a few emails an hour, and it can land in spam.
- **"Exposed tables" in the Supabase dashboard** may show the `dms` tables as off. That is expected; they are granted to signed-in users only.
- **30 October 2026:** Supabase stops auto-granting API access to new tables in `public` on existing projects. Does not affect `dms`. It will affect new tables in Malcolm's other apps.
- **Signed-in Spin users skip the signup page.** Spin's middleware (`radio1/lib/supabase/middleware.ts`) bounces anyone with a session from `/signup` into the app, so testing a link while signed in to Spin lands you in the app. New visitors stay on `/signup` with the `utm_*` and `dms_click` values in the URL. The landing page `/` is behind the pre-launch access code, which is why links point at `/signup`.
- **A new link domain can look broken for a while** if the browser checked it before the DNS record existed (cached "not found"). Use a private window, or flush the Mac's cache: `sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder`.
- **A wrong `SUPABASE_SECRET_KEY` makes every short link answer "Link not found".** Supabase rejects the key with a 401 and the route treats the empty result as a missing link. The route now logs `[redirect] brand lookup failed` / `link lookup failed` in Vercel's runtime logs. When copying the key, use the copy icon in Supabase; selecting the masked text copies the dots.
- **Env var changes need a new deployment.** Push to `main` or run `vercel deploy --prod` from this folder.
- **The Vercel connector in Claude cannot create projects (403).** The Vercel CLI on this Mac is logged in to the team and was used instead.
- **`npm run typecheck`** runs `next typegen` first, because `PageProps` and `LayoutProps` are generated types and a fresh clone does not have them.

## Spin audit findings (from reading `radio1`, 5 October)

- `SPIN_STATUS_REPORT.md` is dated 12 June and is stale (330 commits since). Read the code.
- Spin is a Next.js web app at `spinmusic.uk` with public sign-up; the iOS app is a Capacitor wrapper around the same site. **Web sign-up works on any device.** Android has no app (Google Play is blocked on a D-U-N-S number).
- One creator role in the product: role picker offers Listener, **Spinner** (key `broadcaster`) and Advertiser. Role is chosen at `/welcome` after auth, via `app/api/role/select/route.ts`.
- Sign-up page `app/(auth)/signup/page.tsx` reads only `redirectTo`. It stores no campaign tag, invite code or source. Google/Apple OAuth come first on that page, so the tag must survive an OAuth round trip (cookie).
- A pattern to copy: the pre-launch gate links a visitor id to the account that later signs up (`lib/site-gate.ts`, `app/api/gate/claim/route.ts`, `scripts/add-gate-tracking.sql`, `profiles.gate_visitor_id`).
- Already recorded: `profiles` (created date, role, country), `user_installs` (platform, first seen), `tracks` (first upload is derivable), earnings ledger and `tips` (first earning is derivable), `engagement_events`, `track_plays`.
- **First broadcast is recorded** in `broadcast_sessions` (started_at, ended_at), from 2026-06-05 onwards. (The first audit missed this table.)
- The only referral mechanism is a 10% commission to a referring Spinner on a track sale.
- Spin's schema is mostly unversioned: about 63 SQL scripts in `radio1/scripts/`, five files in `supabase/migrations/`.
- `app/components/LandingPage.tsx` line 175 still says "Free live caster". Malcolm was told; not changed.

## Open items with Malcolm

- Date of the Indvstry Exchange mentorship programme in Kenya (December, unconfirmed). Submissions are closed. Submitters gave an email but no marketing consent, so inviting them needs an opt-in first (programme update email with an opt-in link, QR code at the event, or the partner's channels). The form accepted ages from 13.
- Whether to move the outreach module ahead of the content engine (suggested by Cowork, unanswered).
- Ten `SECURITY DEFINER` functions belonging to the Level app in `mot-platform` are callable without signing in (for example `admin_set_role`, `admin_list_users`). Reported, not investigated, not changed.
- The strategy doc's pain and promise wording is still a proposal.
