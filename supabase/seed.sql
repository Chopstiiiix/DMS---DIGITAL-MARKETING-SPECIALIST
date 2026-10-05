-- First organization and brand. Run once, after the migration.
-- Memberships are added separately, once the user account exists:
--
--   insert into dms.memberships (org_id, user_id, role)
--   select o.id, u.id, 'owner'
--   from dms.organizations o, auth.users u
--   where o.name = 'Inspire' and u.email = '<the account email>';

with org as (
  insert into dms.organizations (name) values ('Inspire') returning id
)
insert into dms.brands (org_id, name, slug, link_domain, default_destination, allowed_hosts)
select
  org.id,
  'Spin Music',
  'spin',
  'go.spinmusic.uk',
  'https://spinmusic.uk/signup',
  array['spinmusic.uk', 'apps.apple.com']
from org;
