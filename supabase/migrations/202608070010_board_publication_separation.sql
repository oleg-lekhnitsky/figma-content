alter table public.public_collections
  add column if not exists publication_enabled boolean not null default true;

update public.public_collections
set publication_enabled = false
where revoked_at is not null;

alter table public.public_collections
  add column if not exists content_strategy text not null default 'snapshot'
  check (content_strategy in ('dynamic', 'snapshot', 'manual'));

update public.public_collections
set content_strategy = case when mode = 'dynamic' then 'dynamic' else 'snapshot' end;

create index if not exists public_collections_public_slug_idx
  on public.public_collections(slug)
  where publication_enabled = true;
