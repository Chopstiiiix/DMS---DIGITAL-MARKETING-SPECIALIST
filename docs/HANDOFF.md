# DMS handoff — 5 October 2026

Handed from a Claude Cowork session to Claude CLI. Cowork could not push to
GitHub or create the Vercel project, so the code is built and tested but
**nothing is deployed and nothing has been pushed**.

## Where things stand

| Thing | State |
| --- | --- |
| Code | In `~/INSPIRE_EDGE/dms`. Two local commits on `main`, plus uncommitted `CLAUDE.md` and `docs/` (this handoff). Not pushed. |
| GitHub | `https://github.com/Chopstiiiix/DMS---DIGITAL-MARKETING-SPECIALIST.git` set as `origin`. Repo is empty. |
| Database | Schema applied to Supabase project `mot-platform` (migration `dms_init`). First org and brand seeded. `dms` schema exposed through the Data API. |
| Vercel | No project yet. Team: "Chopper's projects" (`team_Sv4x7CmXpc3UlyGxo9nMtIP0`). |
| Sign-in | Built (email link or password). Never tested against the real project. |
| Short-link domain | `go.spinmusic.uk` chosen and stored on the brand. No DNS record yet. |
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

Not verified (do these first after deploying):

- A real API call through Supabase's Data API against the `dms` schema. Cowork's network could not reach `supabase.co`.
- The emailed sign-in link, end to end.
- The redirect writing a real click row.
- Anything on Vercel.

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
| Spin app repo | `~/INSPIRE_EDGE/radio1` (`github.com/Chopstiiiix/RADIO1`) |

## Environment variables for Vercel

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://amxkbtjibfgvykexvkus.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | copy from `.env.example` |
| `SUPABASE_SECRET_KEY` | Malcolm copies it from Supabase → mot-platform → Settings → API Keys. Never put it in chat or in git. |
| `LINK_HASH_SALT` | Generate with `openssl rand -hex 32`. Safe to generate fresh: no clicks are recorded yet. Do not rotate it later without accepting that same-day visitor counts reset. |
| `APP_HOSTS` | Leave empty until the app gets a custom domain. See the warning below. |

## Next steps, in order

1. **Clean up git, install, check, commit, push.** The Cowork sandbox could not delete files, so `.git/_stale/` holds empty stray lock files and `.git/objects` has `tmp_obj_*` leftovers. Run `rm -rf .git/_stale && git gc --prune=now`, then `npm install`, run the checks, commit `CLAUDE.md` and `docs/`, and `git push -u origin main`.
2. **Create the Vercel project** `dms` in "Chopper's projects", linked to the GitHub repo. Set the env vars above. Deploy to production.
3. **Allow the sign-in link.** In Supabase → mot-platform → Authentication → URL Configuration → Redirect URLs, add `https://<production host>/auth/callback`.
4. **Smoke test on production.**
   - Sign in with the email link (same browser that requested it).
   - Create a link, then open the fallback URL shown in the list (`/r/<brand id>/<slug>` while the custom domain is not set up).
   - Confirm a row in `dms.link_clicks` and a click on the dashboard.
   - If the Data API returns a permission error, fix it with an explicit grant in a new migration. Do not grant to `anon`, and do not switch tables on in the dashboard's "Exposed tables" list.
5. **Short-link domain.** Add `go.spinmusic.uk` to the Vercel project and create the DNS record in Cloudflare (Spin's DNS is on Cloudflare). Re-test a link on the real domain.
6. **Spin signup change** (in `radio1`, on a branch, for Malcolm's review): store `dms_click` and the `utm_*` values on the new account. Details below.
7. **Spin read-only access**: a dedicated read-only Postgres role limited to a few reporting views in the `Radio1` project. Write the SQL and show Malcolm before running it.
8. **Sync job in DMS**: scheduled job that reads those views and upserts `dms.funnel_events` with the service role.
9. Then Phase 2 (content engine) per `docs/PLAN.md`. Cowork suggested moving the outreach module ahead of it, since Malcolm now owns every first-month channel himself. He has not answered.

## Things that will bite

- **`APP_HOSTS`.** `proxy.ts` treats `localhost`, `*.vercel.app` and anything in `APP_HOSTS` as the app. Every other host is treated as a brand's link domain, where each path is a short link. If the app is ever given a custom domain, add it to `APP_HOSTS` first or the dashboard will 404.
- **Shared Supabase project.** `mot-platform` also holds MotCheck, Confirmo and Level. Their accounts can authenticate against DMS but see nothing (tested). Any new auth user in that project automatically gets a Level profile through a trigger, which is one reason sign-in never creates accounts.
- **Sign-in email** uses Supabase's built-in sender unless custom SMTP is configured: a few emails an hour, and it can land in spam.
- **"Exposed tables" in the Supabase dashboard** may show the `dms` tables as off. That is expected; they are granted to signed-in users only.
- **30 October 2026:** Supabase stops auto-granting API access to new tables in `public` on existing projects. Does not affect `dms`. It will affect new tables in Malcolm's other apps.
- **Git inside the Cowork sandbox** left stray lock files after each commit. A normal terminal does not have this problem.

## Spin audit findings (from reading `radio1`, 5 October)

- `SPIN_STATUS_REPORT.md` is dated 12 June and is stale (330 commits since). Read the code.
- Spin is a Next.js web app at `spinmusic.uk` with public sign-up; the iOS app is a Capacitor wrapper around the same site. **Web sign-up works on any device.** Android has no app (Google Play is blocked on a D-U-N-S number).
- One creator role in the product: role picker offers Listener, **Spinner** (key `broadcaster`) and Advertiser. Role is chosen at `/welcome` after auth, via `app/api/role/select/route.ts`.
- Sign-up page `app/(auth)/signup/page.tsx` reads only `redirectTo`. It stores no campaign tag, invite code or source. Google/Apple OAuth come first on that page, so the tag must survive an OAuth round trip (cookie).
- A pattern to copy: the pre-launch gate links a visitor id to the account that later signs up (`lib/site-gate.ts`, `app/api/gate/claim/route.ts`, `scripts/add-gate-tracking.sql`, `profiles.gate_visitor_id`).
- Already recorded: `profiles` (created date, role, country), `user_installs` (platform, first seen), `tracks` (first upload is derivable), earnings ledger and `tips` (first earning is derivable), `engagement_events`, `track_plays`.
- **No durable "first broadcast" record was found.** `broadcaster_profiles.is_live` is current state only. It may be derivable from `track_plays` written by `server/unified.ts`; check against the live database.
- The only referral mechanism is a 10% commission to a referring Spinner on a track sale.
- Spin's schema is mostly unversioned: about 63 SQL scripts in `radio1/scripts/`, five files in `supabase/migrations/`.
- `app/components/LandingPage.tsx` line 175 still says "Free live caster". Malcolm was told; not changed.

## Open items with Malcolm

- Date of the Indvstry Exchange mentorship programme in Kenya (December, unconfirmed). Submissions are closed. Submitters gave an email but no marketing consent, so inviting them needs an opt-in first (programme update email with an opt-in link, QR code at the event, or the partner's channels). The form accepted ages from 13.
- Whether to move the outreach module ahead of the content engine (suggested by Cowork, unanswered).
- Ten `SECURITY DEFINER` functions belonging to the Level app in `mot-platform` are callable without signing in (for example `admin_set_role`, `admin_list_users`). Reported, not investigated, not changed.
- The strategy doc's pain and promise wording is still a proposal.

## First prompt for Claude CLI

Open your computer's terminal, paste this and run it:

```
cd ~/INSPIRE_EDGE/dms && claude
```

Then paste:

```
Read CLAUDE.md, docs/HANDOFF.md, docs/PLAN.md and README.md. Then do
"Next steps" 1 to 4 from docs/HANDOFF.md: clean up git, npm install, run all
checks, commit CLAUDE.md and docs/, push to origin main, create the Vercel
project "dms" in the team "Chopper's projects" linked to this repo, set the
environment variables, and deploy to production. Ask me for the Supabase
secret key by telling me where to paste it in Vercel; do not ask me to paste
it into this chat. Stop and report after the production smoke test.
```
