-- DMS (Digital Marketing Specialist) — Phase 1 schema
--
-- Everything lives in its own schemas, `dms` and `dms_private`, so DMS can
-- share a Supabase project with other apps without touching their tables and
-- can be moved to its own project later with `pg_dump -n dms -n dms_private`.
-- `dms` must be added to the project's exposed schemas (Settings → API).
--
-- Tenancy: every row carries org_id; RLS limits reads/writes to org members.
-- Click, funnel and audit rows are written only by the service role (the
-- redirect handler and sync jobs), never by a browser client.
--
-- Access is granted explicitly at the end of this file. Signed-out (anon)
-- clients get no access to these schemas at all.

create schema if not exists dms;

-- Helper functions live outside the API-exposed schema.
create schema if not exists dms_private;

-- ───────────────────────── Tenancy ─────────────────────────

create table dms.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 120),
  created_at timestamptz not null default now()
);

create table dms.memberships (
  org_id     uuid not null references dms.organizations(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index memberships_user_idx on dms.memberships (user_id);

-- SECURITY DEFINER so policies on other tables can check membership without
-- recursing into memberships' own RLS. search_path pinned.
create or replace function dms_private.is_org_member(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from dms.memberships m
    where m.org_id = p_org and m.user_id = (select auth.uid())
  );
$$;

create or replace function dms_private.is_org_admin(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from dms.memberships m
    where m.org_id = p_org
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  );
$$;


-- ───────────────────────── Brands ─────────────────────────

create table dms.brands (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references dms.organizations(id) on delete cascade,
  name                text not null check (char_length(name) between 1 and 120),
  slug                text not null check (slug ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  -- Host that serves this brand's short links, e.g. go.spinmusic.uk.
  link_domain         text unique check (link_domain = lower(link_domain)),
  -- Where a bare or unknown short link lands.
  default_destination text not null check (default_destination ~ '^https://'),
  -- Hosts a link is allowed to redirect to. Stops the redirector being used
  -- as an open redirect to arbitrary sites.
  allowed_hosts       text[] not null default '{}',
  -- Apple provider token for App Store campaign links (same for every campaign).
  app_store_pt        text,
  created_at          timestamptz not null default now(),
  unique (org_id, slug)
);
create index brands_org_idx on dms.brands (org_id);

-- ───────────────────────── Campaigns ─────────────────────────

create table dms.campaigns (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references dms.organizations(id) on delete cascade,
  brand_id    uuid not null references dms.brands(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 120),
  slug        text not null check (slug ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  starts_on   date,
  ends_on     date,
  -- Paid-ready: stays 0 while marketing is organic only.
  spend_cents bigint not null default 0 check (spend_cents >= 0),
  currency    text not null default 'GBP' check (currency ~ '^[A-Z]{3}$'),
  created_at  timestamptz not null default now(),
  unique (brand_id, slug)
);
create index campaigns_org_idx on dms.campaigns (org_id);

-- ───────────────────────── Links ─────────────────────────

create table dms.links (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references dms.organizations(id) on delete cascade,
  brand_id        uuid not null references dms.brands(id) on delete cascade,
  campaign_id     uuid references dms.campaigns(id) on delete set null,
  slug            text not null check (slug ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  label           text not null check (char_length(label) between 1 and 160),
  destination_url text not null check (destination_url ~ '^https://'),
  -- Where the link is shared: instagram, email, dm, partner, event, …
  channel         text not null check (channel ~ '^[a-z0-9_]{1,30}$'),
  -- Content pillar the post belongs to (optional).
  pillar          text check (pillar is null or pillar ~ '^[a-z0-9_]{1,30}$'),
  is_active       boolean not null default true,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (brand_id, slug)
);
create index links_org_idx on dms.links (org_id);
create index links_brand_idx on dms.links (brand_id);
create index links_campaign_idx on dms.links (campaign_id);
create index links_created_by_idx on dms.links (created_by);

-- ───────────────────────── Clicks ─────────────────────────

create table dms.link_clicks (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references dms.organizations(id) on delete cascade,
  brand_id     uuid not null references dms.brands(id) on delete cascade,
  link_id      uuid not null references dms.links(id) on delete cascade,
  clicked_at   timestamptz not null default now(),
  country      text check (country is null or country ~ '^[A-Z]{2}$'),
  device       text not null default 'unknown' check (device in ('mobile', 'tablet', 'desktop', 'unknown')),
  os           text not null default 'unknown' check (os in ('ios', 'android', 'windows', 'macos', 'linux', 'unknown')),
  referer_host text,
  -- Salted daily hash of IP + user agent. Counts unique visitors per day
  -- without storing the IP address itself.
  visitor_hash text,
  is_bot       boolean not null default false
);
create index link_clicks_org_idx on dms.link_clicks (org_id);
create index link_clicks_brand_time_idx on dms.link_clicks (brand_id, clicked_at desc);
create index link_clicks_link_time_idx on dms.link_clicks (link_id, clicked_at desc);

-- ───────────────────────── Funnel events ─────────────────────────
-- Product-side events (signup, activation, …) synced from each brand's own
-- database. external_user_id is the user id in that product.

create table dms.funnel_events (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references dms.organizations(id) on delete cascade,
  brand_id         uuid not null references dms.brands(id) on delete cascade,
  event_type       text not null check (event_type in ('signup', 'first_upload', 'first_broadcast', 'activation', 'first_earning')),
  external_user_id text not null,
  occurred_at      timestamptz not null,
  -- Attribution, when the product recorded which click brought the user in.
  click_id         uuid references dms.link_clicks(id) on delete set null,
  link_id          uuid references dms.links(id) on delete set null,
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  unique (brand_id, event_type, external_user_id)
);
create index funnel_events_org_idx on dms.funnel_events (org_id);
create index funnel_events_brand_time_idx on dms.funnel_events (brand_id, occurred_at desc);
create index funnel_events_link_idx on dms.funnel_events (link_id);
create index funnel_events_click_idx on dms.funnel_events (click_id);

-- ───────────────────────── Audit ─────────────────────────

create table dms.audit_events (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references dms.organizations(id) on delete cascade,
  actor_id   uuid references auth.users(id) on delete set null,
  action     text not null,
  entity     text not null,
  entity_id  uuid,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_events_org_time_idx on dms.audit_events (org_id, created_at desc);
create index audit_events_actor_idx on dms.audit_events (actor_id);

-- ───────────────────────── Row level security ─────────────────────────

alter table dms.organizations enable row level security;
alter table dms.memberships   enable row level security;
alter table dms.brands        enable row level security;
alter table dms.campaigns     enable row level security;
alter table dms.links         enable row level security;
alter table dms.link_clicks   enable row level security;
alter table dms.funnel_events enable row level security;
alter table dms.audit_events  enable row level security;

create policy organizations_select on dms.organizations
  for select to authenticated
  using ((select dms_private.is_org_member(id)));

create policy memberships_select on dms.memberships
  for select to authenticated
  using ((select dms_private.is_org_member(org_id)));

-- Brands: members read, admins change.
create policy brands_select on dms.brands
  for select to authenticated using ((select dms_private.is_org_member(org_id)));
create policy brands_insert on dms.brands
  for insert to authenticated with check ((select dms_private.is_org_admin(org_id)));
create policy brands_update on dms.brands
  for update to authenticated
  using ((select dms_private.is_org_admin(org_id)))
  with check ((select dms_private.is_org_admin(org_id)));
create policy brands_delete on dms.brands
  for delete to authenticated using ((select dms_private.is_org_admin(org_id)));

-- Campaigns and links: any member can create and edit; admins delete.
create policy campaigns_select on dms.campaigns
  for select to authenticated using ((select dms_private.is_org_member(org_id)));
create policy campaigns_insert on dms.campaigns
  for insert to authenticated with check ((select dms_private.is_org_member(org_id)));
create policy campaigns_update on dms.campaigns
  for update to authenticated
  using ((select dms_private.is_org_member(org_id)))
  with check ((select dms_private.is_org_member(org_id)));
create policy campaigns_delete on dms.campaigns
  for delete to authenticated using ((select dms_private.is_org_admin(org_id)));

create policy links_select on dms.links
  for select to authenticated using ((select dms_private.is_org_member(org_id)));
create policy links_insert on dms.links
  for insert to authenticated with check ((select dms_private.is_org_member(org_id)));
create policy links_update on dms.links
  for update to authenticated
  using ((select dms_private.is_org_member(org_id)))
  with check ((select dms_private.is_org_member(org_id)));
create policy links_delete on dms.links
  for delete to authenticated using ((select dms_private.is_org_admin(org_id)));

-- Read-only for members; written by the service role only (no write policies).
create policy link_clicks_select on dms.link_clicks
  for select to authenticated using ((select dms_private.is_org_member(org_id)));
create policy funnel_events_select on dms.funnel_events
  for select to authenticated using ((select dms_private.is_org_member(org_id)));
create policy audit_events_select on dms.audit_events
  for select to authenticated using ((select dms_private.is_org_admin(org_id)));

-- A link's org must match its brand's org, and a campaign's brand must match.
-- Enforced in the database so a crafted insert cannot cross tenants.
create or replace function dms_private.enforce_link_tenancy()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from dms.brands b where b.id = new.brand_id and b.org_id = new.org_id
  ) then
    raise exception 'brand does not belong to this organization';
  end if;
  if new.campaign_id is not null and not exists (
    select 1 from dms.campaigns c where c.id = new.campaign_id and c.brand_id = new.brand_id
  ) then
    raise exception 'campaign does not belong to this brand';
  end if;
  return new;
end;
$$;

create trigger links_tenancy
  before insert or update on dms.links
  for each row execute function dms_private.enforce_link_tenancy();

create or replace function dms_private.enforce_campaign_tenancy()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from dms.brands b where b.id = new.brand_id and b.org_id = new.org_id
  ) then
    raise exception 'brand does not belong to this organization';
  end if;
  return new;
end;
$$;

create trigger campaigns_tenancy
  before insert or update on dms.campaigns
  for each row execute function dms_private.enforce_campaign_tenancy();

-- ───────────────────────── Reporting ─────────────────────────
-- SECURITY INVOKER: runs as the caller, so RLS on the underlying tables applies.

create or replace function dms.link_stats(p_brand uuid, p_since timestamptz)
returns table (
  link_id     uuid,
  clicks      bigint,
  visitors    bigint,
  signups     bigint,
  activations bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    l.id as link_id,
    coalesce(c.clicks, 0)      as clicks,
    coalesce(c.visitors, 0)    as visitors,
    coalesce(f.signups, 0)     as signups,
    coalesce(f.activations, 0) as activations
  from dms.links l
  left join lateral (
    select
      count(*) as clicks,
      count(distinct lc.visitor_hash) as visitors
    from dms.link_clicks lc
    where lc.link_id = l.id and lc.clicked_at >= p_since and not lc.is_bot
  ) c on true
  left join lateral (
    select
      count(*) filter (where fe.event_type = 'signup')     as signups,
      count(*) filter (where fe.event_type = 'activation') as activations
    from dms.funnel_events fe
    where fe.link_id = l.id and fe.occurred_at >= p_since
  ) f on true
  where l.brand_id = p_brand;
$$;

-- ───────────────────────── Grants ─────────────────────────
-- Explicit and minimal. RLS then narrows rows to the caller's organizations.

revoke all on schema dms, dms_private from public;
revoke all on all tables in schema dms from public, anon, authenticated;
revoke all on all functions in schema dms from public, anon, authenticated;
revoke all on all functions in schema dms_private from public, anon, authenticated;

grant usage on schema dms to authenticated, service_role;
grant usage on schema dms_private to authenticated, service_role;

-- Signed-in users: read everything RLS lets them see…
grant select on all tables in schema dms to authenticated;
-- …and write only the tables the app edits.
grant insert, update, delete on dms.brands, dms.campaigns, dms.links to authenticated;

grant execute on function dms_private.is_org_member(uuid) to authenticated, service_role;
grant execute on function dms_private.is_org_admin(uuid) to authenticated, service_role;
grant execute on function dms.link_stats(uuid, timestamptz) to authenticated, service_role;

-- Server-side jobs (redirect, sync, audit).
grant all on all tables in schema dms to service_role;
