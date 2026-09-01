alter table public.public_collections
  add column asset_scope text not null default 'approved'
  check (asset_scope in ('approved', 'all'));

