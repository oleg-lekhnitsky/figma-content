alter table public.public_collections
  add column if not exists contact_links jsonb not null default '[]'::jsonb
  check (jsonb_typeof(contact_links) = 'array');

update public.public_collections
set contact_links =
  case when contact_email is not null and contact_email <> ''
    then jsonb_build_array(jsonb_build_object('label', contact_email, 'url', 'mailto:' || contact_email))
    else '[]'::jsonb end
  ||
  case when contact_url is not null and contact_url <> ''
    then jsonb_build_array(jsonb_build_object('label', coalesce(nullif(contact_link_label, ''), 'Visit website'), 'url', contact_url))
    else '[]'::jsonb end
where contact_links = '[]'::jsonb;

