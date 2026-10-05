-- Minimal stand-in for the parts of Supabase the migration depends on, so the
-- schema and its row level security can be tested on a plain local Postgres.
-- NOT applied to a real Supabase project.

do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema if not exists auth;

create table if not exists auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text
);

-- Supabase exposes the signed-in user's id from the request JWT.
create or replace function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

-- Supabase's default privileges cover the `public` schema only. DMS lives in
-- its own schemas and grants access explicitly, so nothing is mirrored here:
-- the tests exercise the real grants as well as RLS.
