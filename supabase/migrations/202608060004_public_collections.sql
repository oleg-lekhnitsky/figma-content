create table public.public_collections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references public.allowed_users(id),
  slug uuid not null unique default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  mode text not null check (mode in ('dynamic', 'static')),
  filters jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);

create table public.public_collection_assets (
  collection_id uuid not null references public.public_collections(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (collection_id, asset_id)
);

create index public_collections_org_time_idx on public.public_collections(organization_id, created_at desc);
create index public_collection_assets_collection_idx on public.public_collection_assets(collection_id);

create trigger public_collections_updated_at before update on public.public_collections
  for each row execute function public.set_updated_at();

alter table public.public_collections enable row level security;
alter table public.public_collection_assets enable row level security;

-- Public collections are read through scoped Nuxt server endpoints. No direct
-- client policies are intentionally defined for these tables or private assets.
