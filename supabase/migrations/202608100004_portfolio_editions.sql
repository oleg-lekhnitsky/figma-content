alter table public.public_collections
  add column if not exists portfolio_kind text
  check (portfolio_kind is null or portfolio_kind in ('main', 'client')),
  add column if not exists portfolio_client text,
  add column if not exists introduction text;
