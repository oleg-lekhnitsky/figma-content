-- Local development seed. Change the email before running in a shared environment.
with organization as (
  insert into public.organizations (name, slug)
  values ('Content Library', 'content-library')
  on conflict (slug) do update set name = excluded.name
  returning id
)
insert into public.allowed_users (organization_id, email, role, is_active)
select id, 'oleg.lekhnitsky@gmail.com', 'admin', true from organization
on conflict (organization_id, email) do update set role = 'admin', is_active = true;
