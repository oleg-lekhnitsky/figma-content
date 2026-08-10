alter table public.public_collections drop constraint if exists public_collections_purpose_check;
alter table public.public_collections add constraint public_collections_purpose_check
  check (purpose in ('showcase', 'review', 'portfolio', 'case'));

create table public.portfolio_edition_cases (
  edition_id uuid not null references public.public_collections(id) on delete cascade,
  case_id uuid not null references public.public_collections(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (edition_id, case_id),
  check (edition_id <> case_id)
);

create index portfolio_edition_cases_order_idx on public.portfolio_edition_cases (edition_id, position);
alter table public.portfolio_edition_cases enable row level security;

