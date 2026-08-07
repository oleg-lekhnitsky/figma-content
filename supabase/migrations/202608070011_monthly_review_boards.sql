alter table public.public_collections
  add column if not exists purpose text not null default 'showcase'
  check (purpose in ('showcase', 'review'));

alter table public.public_collections
  add column if not exists review_month date;

alter table public.public_collections
  add column if not exists submission_deadline timestamptz;

create index if not exists public_collections_review_month_idx
  on public.public_collections(organization_id, review_month desc)
  where purpose = 'review';
