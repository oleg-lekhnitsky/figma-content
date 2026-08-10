alter table public.public_collections
  drop constraint if exists public_collections_purpose_check;

alter table public.public_collections
  add constraint public_collections_purpose_check
  check (purpose in ('showcase', 'review', 'portfolio'));
