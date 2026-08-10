alter table public.public_collections
  add column if not exists contact_heading text,
  add column if not exists contact_email text,
  add column if not exists contact_url text,
  add column if not exists contact_link_label text;

