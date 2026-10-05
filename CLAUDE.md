@AGENTS.md

# DMS — Digital Marketing Specialist

Internal marketing platform for Malcolm Olagundoye's products. Spin Music is
the first brand; more will follow. Start with `docs/HANDOFF.md` for current
state and next steps, `docs/PLAN.md` for the build plan, and
`docs/STRATEGY.md` for Spin's marketing strategy.

## Rules that are easy to get wrong

- **Next.js 16.** Middleware is `proxy.ts`, route `params` and page
  `searchParams` are Promises. Read `node_modules/next/dist/docs/` before
  using an API you have not used in this repo.
- **Database lives in the `dms` and `dms_private` schemas** of a Supabase
  project shared with other apps (`mot-platform`). Never create DMS objects in
  `public`, and never touch the other apps' tables, functions or auth users.
- **Every new `dms` table** gets row level security, policies and explicit
  grants in the same migration. Grant to `authenticated` and `service_role`
  only, never to `anon`. See the Database section of `README.md`.
- **Only the service role writes** `link_clicks`, `funnel_events` and
  `audit_events`. Browser-facing code uses `lib/supabase/server.ts` (as the
  user, RLS applies); `lib/supabase/admin.ts` is server-only.
- **Links may only redirect to a brand's `allowed_hosts`.** Do not weaken
  `validateDestination`; the redirector must not become an open redirect.
- **No IP addresses are stored.** Clicks keep a salted daily hash only.
- **Nothing publishes, sends or spends without Malcolm's approval.** AI output
  goes to an approval queue, never straight to a channel.
- **Sign-in never creates accounts.** Access is granted by adding a
  `dms.memberships` row.
- **Spin's own database is read-only to DMS.** Changes to the Spin app
  (`~/INSPIRE_EDGE/radio1`) go on a branch for Malcolm to review, never to main.
- **Secrets** stay in Vercel env vars or `.env.local`. Never commit them.

## Terms

- **Spinner**: an artist/creator on Spin. The word "caster" is retired; do not
  use it. Listeners are listeners.
- **Brand**: one product being marketed (Spin Music today). Each has its own
  workspace and short-link domain.

## Checks before committing

`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and
`./scripts/test-db.sh` after any migration change.
