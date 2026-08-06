create extension if not exists pgcrypto;

create type public.user_role as enum ('viewer', 'contributor', 'editor', 'admin');
create type public.asset_status as enum ('draft', 'approved', 'archived');
create type public.audit_action as enum (
  'login', 'upload', 'edit', 'approve', 'archive', 'delete', 'invite',
  'role_change', 'user_disable', 'session_revoke'
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.allowed_users (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text,
  figma_user_id text,
  figma_handle text,
  avatar_url text,
  role public.user_role not null default 'viewer',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz,
  constraint allowed_users_identity_check check (email is not null or figma_user_id is not null),
  unique (organization_id, email),
  unique (organization_id, figma_user_id)
);
create unique index allowed_users_figma_identity_idx on public.allowed_users(figma_user_id)
  where figma_user_id is not null;

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  allowed_user_id uuid not null references public.allowed_users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index sessions_user_active_idx on public.sessions(allowed_user_id, expires_at)
  where revoked_at is null;

create table public.oauth_states (
  id uuid primary key default gen_random_uuid(),
  state_hash text not null unique,
  code_verifier_encrypted text not null,
  flow text not null check (flow in ('web', 'plugin')),
  redirect_uri text,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.plugin_auth_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  allowed_user_id uuid not null references public.allowed_users(id) on delete cascade,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  slug text not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, slug),
  unique (id, organization_id)
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null,
  name text not null check (char_length(name) between 1 and 120),
  slug text not null,
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  foreign key (project_id, organization_id) references public.projects(id, organization_id),
  unique (organization_id, project_id, slug),
  unique (id, organization_id),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text check (char_length(description) <= 5000),
  uploaded_by uuid not null references public.allowed_users(id),
  image_path text not null,
  thumbnail_path text,
  mime_type text not null check (mime_type in ('image/png', 'image/jpeg')),
  file_size bigint not null check (file_size > 0),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  image_format text not null check (image_format in ('png', 'jpg')),
  figma_file_key text not null,
  figma_node_id text not null,
  figma_node_name text not null,
  figma_url text not null,
  project_id uuid,
  campaign_id uuid,
  language text,
  content_type text,
  status public.asset_status not null default 'draft',
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  foreign key (project_id, organization_id) references public.projects(id, organization_id),
  foreign key (campaign_id, organization_id) references public.campaigns(id, organization_id),
  unique (id, organization_id)
);
create index assets_library_idx on public.assets(organization_id, status, created_at desc);
create index assets_figma_node_idx on public.assets(organization_id, figma_file_key, figma_node_id);

create table public.asset_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  asset_id uuid not null,
  version integer not null check (version > 0),
  image_path text not null,
  thumbnail_path text,
  mime_type text not null check (mime_type in ('image/png', 'image/jpeg')),
  file_size bigint not null check (file_size > 0),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.allowed_users(id),
  created_at timestamptz not null default now(),
  foreign key (asset_id, organization_id) references public.assets(id, organization_id) on delete cascade,
  unique (asset_id, version)
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  slug text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, slug),
  unique (id, organization_id)
);

create table public.asset_tags (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  asset_id uuid not null,
  tag_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (asset_id, tag_id),
  foreign key (asset_id, organization_id) references public.assets(id, organization_id) on delete cascade,
  foreign key (tag_id, organization_id) references public.tags(id, organization_id) on delete cascade
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references public.allowed_users(id) on delete set null,
  action public.audit_action not null,
  target_type text not null,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_org_time_idx on public.audit_logs(organization_id, created_at desc);

create function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger organizations_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();
create trigger allowed_users_updated_at before update on public.allowed_users
  for each row execute function public.set_updated_at();
create trigger assets_updated_at before update on public.assets
  for each row execute function public.set_updated_at();

alter table public.organizations enable row level security;
alter table public.allowed_users enable row level security;
alter table public.sessions enable row level security;
alter table public.oauth_states enable row level security;
alter table public.plugin_auth_codes enable row level security;
alter table public.projects enable row level security;
alter table public.campaigns enable row level security;
alter table public.assets enable row level security;
alter table public.asset_versions enable row level security;
alter table public.tags enable row level security;
alter table public.asset_tags enable row level security;
alter table public.audit_logs enable row level security;

-- No client-facing RLS policies are intentional. The Nuxt server authenticates,
-- authorizes, and scopes every query while using the service role. The anon key
-- cannot read these tables or the private bucket directly.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('assets', 'assets', false, 10485760, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = false;
