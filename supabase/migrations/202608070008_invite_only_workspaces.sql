create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  email text,
  figma_user_id text,
  password_hash text,
  must_change_password boolean not null default false,
  failed_login_count integer not null default 0 check (failed_login_count >= 0),
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email is not null or figma_user_id is not null)
);
create unique index accounts_email_idx on public.accounts(lower(email)) where email is not null;
create unique index accounts_figma_user_idx on public.accounts(figma_user_id) where figma_user_id is not null;

alter table public.allowed_users add column account_id uuid references public.accounts(id) on delete cascade;

insert into public.accounts (email, figma_user_id, password_hash, must_change_password, failed_login_count, locked_until)
select distinct on (coalesce(lower(email), 'figma:' || figma_user_id))
  lower(email), figma_user_id, password_hash, must_change_password, failed_login_count, locked_until
from public.allowed_users
order by coalesce(lower(email), 'figma:' || figma_user_id), password_hash nulls last;

update public.allowed_users member
set account_id = account.id
from public.accounts account
where (member.email is not null and lower(member.email) = lower(account.email))
   or (member.email is null and member.figma_user_id = account.figma_user_id);

alter table public.allowed_users alter column account_id set not null;
create unique index allowed_users_account_org_idx on public.allowed_users(account_id, organization_id);

alter table public.organizations add column created_by uuid references public.accounts(id) on delete set null;
update public.organizations organization
set created_by = member.account_id
from public.allowed_users member
where member.organization_id = organization.id and member.role = 'admin' and organization.created_by is null;

create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role public.user_role not null default 'viewer',
  token_hash text not null unique,
  invited_by uuid not null references public.allowed_users(id) on delete cascade,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_account_id uuid references public.accounts(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (email = lower(email))
);
create index organization_invitations_org_idx on public.organization_invitations(organization_id, created_at desc);

create trigger accounts_updated_at before update on public.accounts
  for each row execute function public.set_updated_at();
alter table public.accounts enable row level security;
alter table public.organization_invitations enable row level security;

-- Credentials now belong to the person, not an individual workspace membership.
drop index if exists public.allowed_users_password_email_idx;
alter table public.allowed_users drop column password_hash;
alter table public.allowed_users drop column must_change_password;
alter table public.allowed_users drop column failed_login_count;
alter table public.allowed_users drop column locked_until;
