alter table public.public_collection_assets
  add column if not exists review_status text not null default 'ready'
  check (review_status in ('ready', 'reviewed'));

alter table public.public_collection_assets
  add column if not exists reviewed_at timestamptz;

alter table public.public_collection_assets
  add column if not exists reviewed_by uuid references public.allowed_users(id) on delete set null;

create index if not exists public_collection_assets_review_status_idx
  on public.public_collection_assets(collection_id, review_status, created_at desc);
