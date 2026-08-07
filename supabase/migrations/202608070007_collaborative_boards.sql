do $$ begin
  create type public.board_role as enum ('owner', 'editor', 'contributor', 'viewer');
exception when duplicate_object then null;
end $$;

create unique index if not exists allowed_users_id_org_idx
  on public.allowed_users(id, organization_id);

create table if not exists public.public_collection_members (
  collection_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  role public.board_role not null default 'viewer',
  invited_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (collection_id, user_id),
  foreign key (collection_id, organization_id)
    references public.public_collections(id, organization_id) on delete cascade,
  foreign key (user_id, organization_id)
    references public.allowed_users(id, organization_id) on delete cascade,
  foreign key (invited_by)
    references public.allowed_users(id) on delete set null
);

insert into public.public_collection_members (collection_id, organization_id, user_id, role, invited_by)
select id, organization_id, created_by, 'owner'::public.board_role, created_by
from public.public_collections
on conflict (collection_id, user_id) do update set role = 'owner'::public.board_role;

alter table public.public_collection_assets
  add column if not exists added_by uuid references public.allowed_users(id) on delete set null;

alter table public.public_collection_assets
  add column if not exists source text not null default 'snapshot'
  check (source in ('snapshot', 'manual'));

create index if not exists public_collection_members_user_idx
  on public.public_collection_members(organization_id, user_id, created_at desc);

drop trigger if exists public_collection_members_updated_at on public.public_collection_members;
create trigger public_collection_members_updated_at before update on public.public_collection_members
  for each row execute function public.set_updated_at();

alter table public.public_collection_members enable row level security;
