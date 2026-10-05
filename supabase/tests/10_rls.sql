-- Tenant isolation tests. Run after the stub and the migration.
-- Every check raises on failure, so psql -v ON_ERROR_STOP=1 exits non-zero.

\set ON_ERROR_STOP on

-- ── Fixtures (as superuser) ────────────────────────────────────────────────
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'alice@org1.test'),
  ('b0000000-0000-4000-8000-000000000002', 'bob@org2.test'),
  ('c0000000-0000-4000-8000-000000000003', 'carol@org1.test');

insert into dms.organizations (id, name) values
  ('10000000-0000-4000-8000-000000000001', 'Org One'),
  ('20000000-0000-4000-8000-000000000002', 'Org Two');

insert into dms.memberships (org_id, user_id, role) values
  ('10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'owner'),
  ('20000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'owner'),
  ('10000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003', 'member');

insert into dms.brands (id, org_id, name, slug, link_domain, default_destination, allowed_hosts) values
  ('11000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Brand One', 'one', 'go.one.test', 'https://one.test/signup', '{one.test}'),
  ('22000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'Brand Two', 'two', 'go.two.test', 'https://two.test/signup', '{two.test}');

insert into dms.campaigns (id, org_id, brand_id, name, slug) values
  ('1c000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 'Launch', 'launch'),
  ('2c000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', '22000000-0000-4000-8000-000000000002', 'Other', 'other');

insert into dms.links (id, org_id, brand_id, campaign_id, slug, label, destination_url, channel) values
  ('1a000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', '1c000000-0000-4000-8000-000000000001', 'bio', 'Bio link', 'https://one.test/signup', 'instagram'),
  ('2a000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', '22000000-0000-4000-8000-000000000002', null, 'bio', 'Bio link', 'https://two.test/signup', 'instagram');

-- 3 human clicks from 2 visitors + 1 bot on org one's link; 1 click on org two's.
insert into dms.link_clicks (id, org_id, brand_id, link_id, visitor_hash, is_bot) values
  ('1e000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', '1a000000-0000-4000-8000-000000000001', 'v1', false),
  ('1e000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', '1a000000-0000-4000-8000-000000000001', 'v1', false),
  ('1e000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', '1a000000-0000-4000-8000-000000000001', 'v2', false),
  ('1e000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', '1a000000-0000-4000-8000-000000000001', 'v3', true),
  ('2e000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', '22000000-0000-4000-8000-000000000002', '2a000000-0000-4000-8000-000000000002', 'v9', false);

insert into dms.funnel_events (org_id, brand_id, event_type, external_user_id, occurred_at, click_id, link_id) values
  ('10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 'signup',     'u1', now(), '1e000000-0000-4000-8000-000000000001', '1a000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 'activation', 'u1', now(), '1e000000-0000-4000-8000-000000000001', '1a000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 'signup',     'u2', now(), '1e000000-0000-4000-8000-000000000003', '1a000000-0000-4000-8000-000000000001');

-- Helper: assert that a statement is rejected.
create or replace function pg_temp.expect_denied(p_sql text, p_what text) returns void
language plpgsql as $$
declare n bigint;
begin
  begin
    execute p_sql;
    get diagnostics n = row_count;
  exception when others then
    raise notice 'ok   - denied: % (%)', p_what, sqlerrm;
    return;
  end;
  if n = 0 then
    raise notice 'ok   - no rows affected: %', p_what;
    return;
  end if;
  raise exception 'FAIL - expected denial: % (% rows affected)', p_what, n;
end $$;

create or replace function pg_temp.expect_eq(p_actual bigint, p_expected bigint, p_what text) returns void
language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FAIL - %: expected %, got %', p_what, p_expected, p_actual;
  end if;
  raise notice 'ok   - %: %', p_what, p_actual;
end $$;

-- ── Alice (owner, org one) ─────────────────────────────────────────────────
set role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000001', false);

select pg_temp.expect_eq((select count(*) from dms.organizations), 1, 'alice sees only her organization');
select pg_temp.expect_eq((select count(*) from dms.brands), 1, 'alice sees only her brand');
select pg_temp.expect_eq((select count(*) from dms.links), 1, 'alice sees only her links');
select pg_temp.expect_eq((select count(*) from dms.campaigns), 1, 'alice sees only her campaigns');
select pg_temp.expect_eq((select count(*) from dms.link_clicks), 4, 'alice sees only her clicks');
select pg_temp.expect_eq((select count(*) from dms.funnel_events), 3, 'alice sees only her funnel events');
select pg_temp.expect_eq((select count(*) from dms.memberships), 2, 'alice sees only her org''s memberships');

select pg_temp.expect_eq(
  (select clicks from dms.link_stats('11000000-0000-4000-8000-000000000001', now() - interval '1 day')),
  3, 'stats count human clicks only (bot excluded)');
select pg_temp.expect_eq(
  (select visitors from dms.link_stats('11000000-0000-4000-8000-000000000001', now() - interval '1 day')),
  2, 'stats count distinct visitors');
select pg_temp.expect_eq(
  (select signups from dms.link_stats('11000000-0000-4000-8000-000000000001', now() - interval '1 day')),
  2, 'stats count signups');
select pg_temp.expect_eq(
  (select activations from dms.link_stats('11000000-0000-4000-8000-000000000001', now() - interval '1 day')),
  1, 'stats count activations');
select pg_temp.expect_eq(
  (select count(*) from dms.link_stats('22000000-0000-4000-8000-000000000002', now() - interval '1 day')),
  0, 'stats for another org''s brand return nothing');

-- Allowed: a new link in her own brand.
insert into dms.links (org_id, brand_id, slug, label, destination_url, channel)
values ('10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 'new', 'New', 'https://one.test/', 'email');
select pg_temp.expect_eq((select count(*) from dms.links), 2, 'alice can create a link in her brand');

-- Denied: anything touching org two.
select pg_temp.expect_denied($$insert into dms.links (org_id, brand_id, slug, label, destination_url, channel)
  values ('20000000-0000-4000-8000-000000000002', '22000000-0000-4000-8000-000000000002', 'hack', 'x', 'https://two.test/', 'email')$$,
  'insert link into another org');
select pg_temp.expect_denied($$insert into dms.links (org_id, brand_id, slug, label, destination_url, channel)
  values ('10000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000002', 'hack', 'x', 'https://two.test/', 'email')$$,
  'insert link claiming own org but another org''s brand');
select pg_temp.expect_denied($$insert into dms.links (org_id, brand_id, campaign_id, slug, label, destination_url, channel)
  values ('10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', '2c000000-0000-4000-8000-000000000002', 'hack2', 'x', 'https://one.test/', 'email')$$,
  'attach another brand''s campaign to own link');
select pg_temp.expect_denied($$update dms.links set destination_url = 'https://evil.test/' where id = '2a000000-0000-4000-8000-000000000002'$$,
  'update another org''s link');
select pg_temp.expect_denied($$update dms.links set org_id = '20000000-0000-4000-8000-000000000002' where slug = 'new'$$,
  'move own link into another org');
select pg_temp.expect_denied($$delete from dms.links where id = '2a000000-0000-4000-8000-000000000002'$$,
  'delete another org''s link');
select pg_temp.expect_denied($$update dms.brands set allowed_hosts = '{evil.test}' where id = '22000000-0000-4000-8000-000000000002'$$,
  'update another org''s brand');

-- Denied even inside her own org: system tables are written by the service role only.
select pg_temp.expect_denied($$insert into dms.link_clicks (org_id, brand_id, link_id)
  values ('10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', '1a000000-0000-4000-8000-000000000001')$$,
  'user inserts a click');
select pg_temp.expect_denied($$delete from dms.link_clicks$$, 'user deletes clicks');
select pg_temp.expect_denied($$insert into dms.funnel_events (org_id, brand_id, event_type, external_user_id, occurred_at)
  values ('10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 'signup', 'fake', now())$$,
  'user inserts a funnel event');
select pg_temp.expect_denied($$insert into dms.memberships (org_id, user_id, role)
  values ('20000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'owner')$$,
  'user adds herself to another org');
select pg_temp.expect_denied($$insert into dms.organizations (name) values ('Rogue')$$, 'user creates an organization');

-- ── Carol (plain member, org one) ──────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'c0000000-0000-4000-8000-000000000003', false);
select pg_temp.expect_eq((select count(*) from dms.links), 2, 'member reads org links');
select pg_temp.expect_denied($$update dms.brands set allowed_hosts = '{evil.test}' where id = '11000000-0000-4000-8000-000000000001'$$,
  'member (non-admin) changes the brand allow-list');
select pg_temp.expect_denied($$delete from dms.links where slug = 'new'$$, 'member (non-admin) deletes a link');
select pg_temp.expect_eq((select count(*) from dms.audit_events), 0, 'member cannot read the audit log');

-- ── Bob (owner, org two) ───────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000002', false);
select pg_temp.expect_eq((select count(*) from dms.links), 1, 'bob sees only his link');
select pg_temp.expect_eq((select count(*) from dms.link_clicks), 1, 'bob sees only his clicks');

-- ── Signed out ─────────────────────────────────────────────────────────────
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select pg_temp.expect_denied($$select * from dms.brands$$, 'anon reads brands');
select pg_temp.expect_denied($$select * from dms.links$$, 'anon reads links');
select pg_temp.expect_denied($$select * from dms.link_clicks$$, 'anon reads clicks');
select pg_temp.expect_denied($$select dms_private.is_org_member('10000000-0000-4000-8000-000000000001')$$, 'anon calls a helper function');
select pg_temp.expect_denied($$select * from dms.link_stats('11000000-0000-4000-8000-000000000001', now() - interval '1 day')$$,
  'anon calls link_stats');

reset role;
\echo ALL RLS TESTS PASSED
