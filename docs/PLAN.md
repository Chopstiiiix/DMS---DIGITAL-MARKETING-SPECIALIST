# DMS build plan

Approved by Malcolm on 5 October 2026 and updated as decisions were made.
Current state and immediate next steps are in `HANDOFF.md`.

## Why this exists

Malcolm was struggling with four parts of digital marketing at once: strategy,
content consistency, paid ads that did not convert, and not knowing what
works. Those are one problem. Without tracking you cannot tell what works, so
strategy is guesswork, content gets no feedback, and ads amplify an unproven
funnel. DMS is one platform that plans, drafts, schedules, tracks and reports
marketing, with Malcolm approving from a single inbox.

## Decisions

| Topic | Decision |
| --- | --- |
| Name | DMS, "Digital Marketing Specialist" |
| Scope | Brand-agnostic. Spin Music first, other products later. One workspace and one short-link domain per brand. |
| Who it is for | Internal first, SaaS later. Multi-tenant schema from day one; no billing or onboarding yet. |
| Autonomy | AI drafts, Malcolm approves. Nothing publishes, sends or spends without sign-off. |
| Owner | Malcolm alone for now: every channel, every approval, every open question. |
| Spin target | Spinners (the artists) first. Listeners later. |
| Market | Global |
| Budget | Organic only for now. Paid ads come after tracking and winning messages exist. |
| Stack | Next.js 16 + Tailwind on Vercel; Supabase; Claude API; Resend for lifecycle email |
| Database | Shares the existing `mot-platform` Supabase project to avoid a new ~$10/month project. Own schemas `dms` and `dms_private`. |
| Spin data access | Dedicated read-only Postgres role limited to a few reporting views. No writes to Spin. |
| Short links | Per brand. Spin: `go.spinmusic.uk`. |
| Social accounts | Instagram `@spinmusicworld` only, a professional account (API publishing possible). |
| Repository | Own repo: `github.com/Chopstiiiix/DMS---DIGITAL-MARKETING-SPECIALIST` |

## The model the platform is built on

1. **Positioning first.** Who exactly, what pain, why you.
2. **Everything is a funnel.** Reach → Click → (Install) → Signup → Activation → Retention → Revenue → Referral. Marketing means finding the weakest stage and fixing it.
3. **Four channel types.** Owned (email, push, site, community), Earned (word of mouth, press, SEO), Borrowed (partners, collectives), Paid (ads). Paid only amplifies what already converts.
4. **Creative is the main lever.** Message and format matter more than targeting settings.
5. **One north-star metric.** For Spin: activated Spinners per week (signed up, then first upload or first broadcast within 7 days).
6. **The loop.** Plan → ship → measure → learn, weekly. DMS runs this loop.

Correct order of work: tracking → activation → organic to find winning
messages → paid to scale winners.

## Modules

| # | Module | What it does | Status |
| --- | --- | --- | --- |
| 1 | Strategy brain | Brand profile, persona, positioning, funnel definition, goals; AI turns it into a weekly plan | Not started. Strategy itself is written: `STRATEGY.md` |
| 2 | Tracking and attribution | Link builder, click-logging redirect, product sync, funnel dashboard | Links, redirect and dashboard built. Sync not started. |
| 3 | Content engine | Pillars → ideas → drafts → per-platform variants → approval → schedule → publish → metrics back | Not started |
| 4 | Spinner outreach CRM | Lead list of artists, AI-personalised sequences with approval, pipeline | Not started |
| 5 | Lifecycle email | Activation emails triggered by product events | Not started |
| 6 | Weekly review | AI report: what worked, what did not, next week's plan | Not started |
| later | Paid ads | Spend ingest and CAC first, gated campaign creation second | When there is budget |

## Design decisions

- **Publishing goes through an adapter interface.** First adapter is a hosted posting API, not direct integrations. TikTok's audit rejects internal-only tools, and unaudited apps can only post privately. Direct adapters come at the SaaS stage.
- **Manual-publish fallback.** For any platform without API access, the approved post and asset go to Malcolm's phone to post by hand, then get marked as posted. Tracking still works because the link is ours.
- **Attribution without ad spend or a paid attribution tool.** Our short link logs the click and passes a click id to web sign-up. Spin's web sign-up is public, so the App Store is not a blind spot for Spinners.
- **Outreach protects the main domain.** Cold outreach goes from a separate subdomain, never `spinmusic.uk`, so transactional email stays deliverable.
- **Paid-ready data model.** `campaigns.spend_cents` exists already, so the ads module is additive.
- **Jobs:** Vercel Cron draining a Postgres queue. Move to a workflow engine only if needed.

## Tables

Built: `organizations, memberships, brands, campaigns, links, link_clicks,
funnel_events, audit_events`.

Planned for later phases: `personas, channels, content_pillars, content_items,
content_variants, assets, approvals, publications, metrics_daily, leads,
lead_activities, sequences, sequence_steps, ai_runs`.

## Phases

**Phase 0: Foundations.** Done. Strategy written, Spin events audited, social accounts and partner identified.

**Phase 1: Core and tracking.** In progress.
- Done: repo, schema with row level security, sign-in, brand workspace, link builder, redirect, dashboard.
- Remaining: push and deploy, production smoke test, `go.spinmusic.uk`, Spin sign-up change to store the click id, read-only role and views in Spin's database, sync job.
- Result: Malcolm can see which link, post or channel produces activated Spinners.

**Phase 2: Content engine.** Brand-voice profile, pillars, idea and draft generation, per-platform variants, approval inbox, calendar, publishing adapter, manual fallback, metrics pull-back. Instagram first.

**Phase 3: Outreach CRM and lifecycle email.** Lead import, pipeline, AI-personalised sequences with approval, activation emails from Spin events.

**Phase 4: Weekly review loop.** Automated report and next-week plan in the approval inbox.

**Phase 5: Paid ads.** Meta, TikTok, Apple Search Ads: reporting first, then gated campaign creation with spend caps.

**Phase 6: SaaS.** Billing, self-serve onboarding, per-tenant OAuth, platform audits, direct publishing adapters, own Supabase project.

## First dated campaign

Indvstry Exchange (London) and Spin are running a music business mentorship
programme in Kenya in December 2026; the exact date is unconfirmed. Spin
hosted its track submission page (`/industry-exchange`). Submissions are
closed. Submitters gave a track and an email with no Spin account and no
marketing consent. The opportunity is to turn participants into Spinners
through tracked links: an opt-in link in a programme update email, a QR code
at the event, and the partner's own channels.

## Verification targets

- **Tracking:** create a link → click it from a phone → click appears on the dashboard under the right campaign; a test sign-up in Spin appears as a funnel event.
- **Content:** generate a week of drafts → approve one → it publishes to a test account or arrives through the manual fallback → metrics return the next day.
- **Approval gate:** try to publish an unapproved item through the API → rejected and logged in `audit_events`.
- **Tenancy:** a second organization cannot read the first one's rows.

## Sources checked on 5 October 2026

- TikTok content sharing guidelines: https://developers.tiktok.com/docs/en/content-sharing-guidelines
- Meta Marketing API access tiers: https://developers.meta.com/blog/updates-to-ads-management-standard-access-feature/
- Postiz, open-source scheduler (AGPL-3.0, public API): https://github.com/gitroomhq/postiz-app
- Apple, App Store campaign links: https://developer.apple.com/help/app-store-connect/view-app-analytics/manage-campaigns/
- Supabase, tables no longer auto-exposed: https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically
- Supabase, custom schemas: https://supabase.com/docs/guides/api/using-custom-schemas
